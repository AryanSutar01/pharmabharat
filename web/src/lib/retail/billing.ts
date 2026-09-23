import "server-only";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongo";
import { Bill, type BillDoc, type BillPaymentMode } from "@/lib/models/bill";
import { Customer } from "@/lib/models/customer";
import { LoyaltyEntry } from "@/lib/models/loyalty";
import { nextSequence } from "@/lib/models/order";
import { shopSettings } from "@/lib/models/shop-settings";
import { ShopItem, ShopStock } from "@/lib/models/shop-stock";
import { financialYear, round2 } from "@/lib/orders/gst";
import { billLine, billTotals } from "@/lib/retail/gst";
import { pointsExpiryDate, pointsForSpend, redeemPlan } from "@/lib/retail/loyalty";

/** Don't sell what expires this month — the customer would be handed a dud. */
const MIN_SHELF_LIFE_MS = 30 * 24 * 3600 * 1000;

export class BillingError extends Error {
  constructor(
    public code: "empty" | "out_of_stock" | "not_found" | "expired",
    public detail?: string,
  ) {
    super(code);
  }
}

export type ShelfHit = {
  productId: string;
  name: string;
  manufacturer: string;
  packSizeLabel: string;
  schedule: string;
  /** Batches that can be sold, first to expire first (FEFO). */
  batches: {
    stockId: string;
    batchNo: string;
    expiryDate: string;
    qty: number;
    mrp: number;
    gstRate: number;
  }[];
  totalQty: number;
};

/**
 * Search the shelf for the counter. Groups batches under the medicine and
 * orders them first-expiry-first, which is how a shop should dispense.
 */
export async function searchShelf(businessId: mongoose.Types.ObjectId, q: string, limit = 12): Promise<ShelfHit[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  await connectDB();
  const usable = new Date(Date.now() + MIN_SHELF_LIFE_MS);

  const rows = await ShopStock.find(
    {
      businessId,
      qty: { $gt: 0 },
      expiryDate: { $gt: usable },
      name: { $regex: term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" },
    },
    { productId: 1, name: 1, manufacturer: 1, packSizeLabel: 1, schedule: 1, batchNo: 1, expiryDate: 1, qty: 1, mrp: 1, gstRate: 1 },
  )
    .sort({ expiryDate: 1 })
    .limit(limit * 4)
    .lean();

  const byProduct = new Map<string, ShelfHit>();
  for (const r of rows) {
    const key = String(r.productId);
    const hit =
      byProduct.get(key) ??
      ({
        productId: key,
        name: r.name,
        manufacturer: r.manufacturer ?? "",
        packSizeLabel: r.packSizeLabel ?? "",
        schedule: r.schedule ?? "",
        batches: [],
        totalQty: 0,
      } satisfies ShelfHit);
    hit.batches.push({
      stockId: String(r._id),
      batchNo: r.batchNo,
      expiryDate: new Date(r.expiryDate).toISOString(),
      qty: r.qty,
      mrp: r.mrp,
      gstRate: r.gstRate,
    });
    hit.totalQty += r.qty;
    byProduct.set(key, hit);
  }
  return [...byProduct.values()].slice(0, limit);
}

export type BillInput = {
  lines: { stockId: string; qty: number; discountPercent?: number }[];
  customerId?: string;
  customer?: { name?: string; phone?: string };
  payment?: { mode: BillPaymentMode; received?: number };
  /** Loyalty points the customer wants to spend on this bill. */
  redeemPoints?: number;
  prescription?: { doctorName?: string; registrationNo?: string; date?: Date; patientName?: string };
};

/**
 * Writes a bill and takes the stock off the shelf in one transaction, so a
 * bill can never exist for medicine that wasn't there.
 */
export async function createBill(
  businessId: mongoose.Types.ObjectId,
  input: BillInput,
  user: { id: string; name: string },
): Promise<BillDoc> {
  await connectDB();
  if (!input.lines.length) throw new BillingError("empty");

  const stockIds = input.lines.map((l) => l.stockId);
  const batches = await ShopStock.find({ businessId, _id: { $in: stockIds } }).lean();
  const byId = new Map(batches.map((b) => [String(b._id), b]));
  const now = new Date();

  const lines = input.lines.map((l) => {
    const batch = byId.get(l.stockId);
    if (!batch) throw new BillingError("not_found", l.stockId);
    if (new Date(batch.expiryDate) <= now) throw new BillingError("expired", batch.name);
    if (l.qty < 1 || l.qty > batch.qty) throw new BillingError("out_of_stock", batch.name);
    const tax = billLine({ qty: l.qty, mrp: batch.mrp, gstRate: batch.gstRate, discountPercent: l.discountPercent });
    return {
      stockId: batch._id,
      productId: batch.productId,
      name: batch.name,
      packSizeLabel: batch.packSizeLabel,
      batchNo: batch.batchNo,
      expiryDate: batch.expiryDate,
      hsn: batch.hsn,
      schedule: batch.schedule,
      qty: l.qty,
      mrp: batch.mrp,
      cost: batch.cost,
      gstRate: batch.gstRate,
      discountPercent: Math.min(Math.max(l.discountPercent ?? 0, 0), 100),
      ...tax,
    };
  });

  const costTotal = round2(lines.reduce((a, l) => a + l.cost * l.qty, 0));
  const customer = input.customerId
    ? await Customer.findOne(
        { _id: input.customerId, businessId },
        { name: 1, phone: 1, loyaltyPoints: 1, firstVisitAt: 1 },
      ).lean()
    : null;

  // Loyalty: redeem first (it comes off what is payable), then earn on what is paid.
  const { loyalty: rules } = await shopSettings(businessId);
  const gross = billTotals(lines).grandTotal;
  const redeem =
    customer && input.redeemPoints
      ? redeemPlan({ balance: customer.loyaltyPoints ?? 0, billTotal: gross, wantPoints: input.redeemPoints, rules })
      : { points: 0, value: 0 };
  const totals = billTotals(lines, redeem.value);
  const earned = customer ? pointsForSpend(totals.grandTotal, rules) : 0;

  const session = await mongoose.startSession();
  let bill: BillDoc | null = null;
  try {
    await session.withTransaction(async () => {
      for (const l of lines) {
        // Conditional decrement: fails if another counter sold it meanwhile.
        const res = await ShopStock.updateOne(
          { _id: l.stockId, businessId, qty: { $gte: l.qty } },
          { $inc: { qty: -l.qty } },
          { session },
        );
        if (res.modifiedCount !== 1) throw new BillingError("out_of_stock", l.name);
      }

      const fy = financialYear(now);
      const seq = await nextSequence(`bill:${businessId}:${fy}`, session);
      const [doc] = await Bill.create(
        [
          {
            businessId,
            billNo: `${fy}/${String(seq).padStart(5, "0")}`,
            customerId: customer?._id,
            customer: { name: customer?.name ?? input.customer?.name, phone: customer?.phone ?? input.customer?.phone },
            lines,
            totals,
            costTotal,
            payment: { mode: input.payment?.mode ?? "cash", received: input.payment?.received },
            loyalty: { earned, redeemed: redeem.points, value: totals.redeemed },
            prescription: input.prescription,
            createdBy: user.id,
            createdByName: user.name,
          },
        ],
        { session },
      );
      bill = doc.toObject() as BillDoc;

      // Keep the per-product row fresh so the nightly reorder job has a date.
      for (const l of lines) {
        await ShopItem.updateOne(
          { businessId, productId: l.productId },
          { $set: { lastSoldAt: now }, $setOnInsert: { name: l.name } },
          { upsert: true, session },
        );
      }
      if (customer) {
        await Customer.updateOne(
          { _id: customer._id },
          {
            $inc: { visits: 1, totalSpend: totals.grandTotal, loyaltyPoints: earned - redeem.points },
            // $setOnInsert never fires here (the customer already exists), so the
            // first visit has to be filled in explicitly.
            $set: { lastVisitAt: now, firstVisitAt: customer.firstVisitAt ?? now },
          },
          { session },
        );
        const entries = [];
        if (redeem.points > 0) {
          entries.push({
            businessId,
            customerId: customer._id,
            billId: bill._id,
            kind: "redeemed" as const,
            points: -redeem.points,
            value: redeem.value,
            createdBy: user.id,
          });
        }
        if (earned > 0) {
          entries.push({
            businessId,
            customerId: customer._id,
            billId: bill._id,
            kind: "earned" as const,
            points: earned,
            expiresAt: pointsExpiryDate(rules, now),
            createdBy: user.id,
          });
        }
        if (entries.length) await LoyaltyEntry.create(entries, { session, ordered: true });
      }
    });
  } finally {
    await session.endSession();
  }
  return bill!;
}

export async function listBills(
  businessId: mongoose.Types.ObjectId,
  opts: { limit?: number; customerId?: string; from?: Date; to?: Date } = {},
) {
  await connectDB();
  return Bill.find({
    businessId,
    ...(opts.customerId ? { customerId: opts.customerId } : {}),
    ...(opts.from || opts.to ? { createdAt: { ...(opts.from ? { $gte: opts.from } : {}), ...(opts.to ? { $lte: opts.to } : {}) } } : {}),
  })
    .sort({ createdAt: -1 })
    .limit(opts.limit ?? 50)
    .lean();
}

export async function getBill(businessId: mongoose.Types.ObjectId, billId: string) {
  await connectDB();
  if (!mongoose.isValidObjectId(billId)) return null;
  return Bill.findOne({ _id: billId, businessId }).lean();
}

/** Takings for a day, for the counter header. */
export async function dayTotals(businessId: mongoose.Types.ObjectId, from: Date, to: Date) {
  await connectDB();
  const [row] = await Bill.aggregate<{ bills: number; sales: number; cost: number }>([
    { $match: { businessId, status: "final", createdAt: { $gte: from, $lte: to } } },
    { $group: { _id: null, bills: { $sum: 1 }, sales: { $sum: "$totals.grandTotal" }, cost: { $sum: "$costTotal" } } },
  ]);
  const sales = round2(row?.sales ?? 0);
  const cost = round2(row?.cost ?? 0);
  return { bills: row?.bills ?? 0, sales, cost, margin: round2(sales - cost) };
}
