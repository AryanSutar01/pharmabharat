import "server-only";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongo";
import { sendMail } from "@/lib/mail";
import { refillReminderEmail } from "@/lib/mail/templates";
import { Bill } from "@/lib/models/bill";
import { Business } from "@/lib/models/business";
import { Customer } from "@/lib/models/customer";
import { RefillNudge } from "@/lib/models/refill";
import { ShopStock } from "@/lib/models/shop-stock";
import { notify } from "@/lib/notifications";
import { isDueForRefill, refillCycle } from "@/lib/retail/cycle";

const DAY = 24 * 3600 * 1000;
/** How far back we look for the purchase pattern. */
const HISTORY_DAYS = 400;
const MAX_ROWS = 300;

export type RefillRow = {
  customerId: string;
  customerName: string;
  phone: string;
  email: string;
  /** Did they agree to email reminders? */
  reminders: boolean;
  productId: string;
  productName: string;
  gapDays: number;
  lastBoughtAt: string;
  dueAt: string;
  dueOn: string;
  daysLate: number;
  /** Units of that medicine on the shelf right now (0 means none). */
  inStock: number;
  emailedAt: string | null;
  contactedAt: string | null;
};

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Customers due to come back for a repeat medicine, worked out from the gaps
 * between their own purchases. Nothing is typed at the counter for this.
 */
export async function dueRefills(businessId: mongoose.Types.ObjectId, now = new Date()): Promise<RefillRow[]> {
  await connectDB();
  const since = new Date(now.getTime() - HISTORY_DAYS * DAY);

  // (customer, medicine) → the dates they bought it.
  const groups = await Bill.aggregate<{
    _id: { customerId: mongoose.Types.ObjectId; productId: mongoose.Types.ObjectId };
    name: string;
    dates: Date[];
  }>([
    { $match: { businessId, status: "final", customerId: { $ne: null }, createdAt: { $gte: since } } },
    { $unwind: "$lines" },
    {
      $group: {
        _id: { customerId: "$customerId", productId: "$lines.productId" },
        name: { $last: "$lines.name" },
        dates: { $push: "$createdAt" },
      },
    },
    { $match: { "dates.1": { $exists: true } } }, // bought at least twice
    { $limit: 2000 },
  ]);
  if (!groups.length) return [];

  const candidates = groups
    .map((g) => ({ group: g, cycle: refillCycle(g.dates.map((d) => new Date(d)), now) }))
    .filter(({ cycle }) => isDueForRefill(cycle));
  if (!candidates.length) return [];

  const customerIds = [...new Set(candidates.map((c) => String(c.group._id.customerId)))];
  const productIds = [...new Set(candidates.map((c) => String(c.group._id.productId)))];
  const [customers, stock, nudges] = await Promise.all([
    Customer.find({ _id: { $in: customerIds }, businessId, status: "active" }).lean(),
    ShopStock.aggregate<{ _id: mongoose.Types.ObjectId; qty: number }>([
      {
        $match: {
          businessId,
          productId: { $in: productIds.map((id) => new mongoose.Types.ObjectId(id)) },
          units: { $gt: 0 },
          expiryDate: { $gt: now },
        },
      },
      { $group: { _id: "$productId", qty: { $sum: "$units" } } },
    ]),
    RefillNudge.find({ businessId, customerId: { $in: customerIds } }).lean(),
  ]);

  const customerById = new Map(customers.map((c) => [String(c._id), c]));
  const stockById = new Map(stock.map((s) => [String(s._id), s.qty]));
  const nudgeKey = (c: string, p: string, d: string) => `${c}|${p}|${d}`;
  const nudgeBy = new Map(nudges.map((n) => [nudgeKey(String(n.customerId), String(n.productId), n.dueOn), n]));

  return candidates
    .flatMap(({ group, cycle }) => {
      const customer = customerById.get(String(group._id.customerId));
      if (!customer || !cycle.dueAt) return [];
      const dueOn = dayKey(cycle.dueAt);
      const nudge = nudgeBy.get(nudgeKey(String(customer._id), String(group._id.productId), dueOn));
      return [
        {
          customerId: String(customer._id),
          customerName: customer.name,
          phone: customer.phone ?? "",
          email: customer.email ?? "",
          reminders: Boolean(customer.consent?.reminders && customer.email),
          productId: String(group._id.productId),
          productName: group.name,
          gapDays: cycle.gapDays ?? 0,
          lastBoughtAt: cycle.lastBoughtAt.toISOString(),
          dueAt: cycle.dueAt.toISOString(),
          dueOn,
          daysLate: cycle.daysLate ?? 0,
          inStock: stockById.get(String(group._id.productId)) ?? 0,
          emailedAt: nudge?.emailedAt ? new Date(nudge.emailedAt).toISOString() : null,
          contactedAt: nudge?.contactedAt ? new Date(nudge.contactedAt).toISOString() : null,
        } satisfies RefillRow,
      ];
    })
    .sort((a, b) => b.daysLate - a.daysLate || a.customerName.localeCompare(b.customerName))
    .slice(0, MAX_ROWS);
}

/** The counter ticks someone off the call-list. */
export async function markContacted(
  businessId: mongoose.Types.ObjectId,
  row: { customerId: string; productId: string; dueOn: string },
  userId: string,
) {
  await connectDB();
  await RefillNudge.updateOne(
    { businessId, customerId: row.customerId, productId: row.productId, dueOn: row.dueOn },
    { $set: { contactedAt: new Date(), contactedBy: userId } },
    { upsert: true },
  );
}

/**
 * Daily: email the customers who agreed to reminders, and tell the shop about
 * the ones it must ring — and about repeat medicines that aren't on the shelf.
 */
export async function runRefillReminders(businessId: mongoose.Types.ObjectId, now = new Date()) {
  const rows = await dueRefills(businessId, now);
  if (!rows.length) return { due: 0, emailed: 0, toCall: 0, outOfStock: 0 };

  const shop = await Business.findById(businessId, { legalName: 1, tradeName: 1, phone: 1 }).lean();
  const shopName = shop ? shop.tradeName || shop.legalName : "";

  // One email per customer, listing everything they are due.
  const byCustomer = new Map<string, RefillRow[]>();
  for (const r of rows) {
    if (!r.reminders || r.emailedAt) continue;
    byCustomer.set(r.customerId, [...(byCustomer.get(r.customerId) ?? []), r]);
  }

  let emailed = 0;
  for (const [customerId, items] of byCustomer) {
    const mail = refillReminderEmail({
      customerName: items[0].customerName,
      shopName,
      shopPhone: shop?.phone ?? undefined,
      items: items.map((i) => ({ name: i.productName, lastBoughtAt: new Date(i.lastBoughtAt), daysLate: i.daysLate })),
    });
    await sendMail({ to: items[0].email, ...mail });
    await RefillNudge.bulkWrite(
      items.map((i) => ({
        updateOne: {
          filter: { businessId, customerId, productId: i.productId, dueOn: i.dueOn },
          update: { $set: { emailedAt: now } },
          upsert: true,
        },
      })),
    );
    emailed += 1;
  }

  const toCall = rows.filter((r) => !r.reminders && !r.contactedAt).length;
  const outOfStock = new Set(rows.filter((r) => r.inStock === 0).map((r) => r.productId)).size;
  await notify({
    businessId,
    permission: "retail.manage",
    kind: "shop_refills",
    params: { count: rows.length },
    link: "/app/shop/refills",
  });

  return { due: rows.length, emailed, toCall, outOfStock };
}
