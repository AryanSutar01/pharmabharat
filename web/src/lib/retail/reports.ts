import "server-only";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongo";
import { Bill } from "@/lib/models/bill";
import { Customer } from "@/lib/models/customer";
import { ShopStock } from "@/lib/models/shop-stock";
import { round2 } from "@/lib/orders/gst";
import type { DailyPoint, Period, Ranked } from "@/lib/analytics";

const DAY = 24 * 3600 * 1000;
const TZ = "Asia/Kolkata";
/** Nothing sold in this long counts as dead stock. */
export const DEAD_STOCK_DAYS = 90;

function period(current: number, previous: number): Period {
  return {
    current: round2(current),
    previous: round2(previous),
    change: previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : null,
  };
}

/** YYYY-MM-DD in India time for each of the last `days` days, oldest first. */
function dayKeys(now: Date, days: number) {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });
  return Array.from({ length: days }, (_, i) => fmt.format(new Date(now.getTime() - (days - 1 - i) * DAY)));
}

async function totals(businessId: mongoose.Types.ObjectId, from: Date, to: Date) {
  const [row] = await Bill.aggregate<{ sales: number; cost: number; bills: number; discount: number }>([
    { $match: { businessId, status: "final", createdAt: { $gte: from, $lt: to } } },
    {
      $group: {
        _id: null,
        sales: { $sum: "$totals.grandTotal" },
        cost: { $sum: "$costTotal" },
        discount: { $sum: "$totals.discount" },
        bills: { $sum: 1 },
      },
    },
  ]);
  const sales = row?.sales ?? 0;
  const cost = row?.cost ?? 0;
  return { sales, cost, margin: sales - cost, bills: row?.bills ?? 0, discount: row?.discount ?? 0 };
}

export type ShopReport = {
  days: number;
  sales: Period;
  margin: Period;
  bills: Period;
  averageBill: Period;
  /** Margin as a percentage of sales, this period. */
  marginPercent: number;
  daily: DailyPoint[];
  topSellers: Ranked[];
  topMargin: Ranked[];
  deadStock: { productId: string; name: string; qty: number; value: number; lastSoldAt: string | null }[];
  deadStockValue: number;
  customers: { newCount: number; repeatCount: number; lapsed: number; total: number; top: Ranked[] };
  expiryLoss: { count: number; value: number };
  gst: { rate: number; taxable: number; cgst: number; sgst: number }[];
};

/**
 * Everything the shop's reports page shows, for the last `days` days against
 * the `days` before that.
 */
export async function shopReport(businessId: mongoose.Types.ObjectId, now = new Date(), days = 30): Promise<ShopReport> {
  await connectDB();
  const since = new Date(now.getTime() - days * DAY);
  const before = new Date(since.getTime() - days * DAY);

  const [current, prev] = await Promise.all([totals(businessId, since, now), totals(businessId, before, since)]);

  const dailyRows = await Bill.aggregate<{ _id: string; v: number }>([
    { $match: { businessId, status: "final", createdAt: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: TZ } },
        v: { $sum: "$totals.grandTotal" },
      },
    },
  ]);
  const byDay = new Map(dailyRows.map((r) => [r._id, r.v]));
  const daily = dayKeys(now, days).map((date) => ({ date, value: round2(byDay.get(date) ?? 0) }));

  // Movers: by sales value and by margin, so a shop can see what actually pays.
  const movers = await Bill.aggregate<{ _id: mongoose.Types.ObjectId; name: string; sales: number; margin: number; packs: number }>([
    { $match: { businessId, status: "final", createdAt: { $gte: since } } },
    { $unwind: "$lines" },
    {
      $group: {
        _id: "$lines.productId",
        name: { $last: "$lines.name" },
        sales: { $sum: "$lines.total" },
        margin: {
          $sum: {
            $subtract: [
              "$lines.total",
              // Cost is per pack, so a cut strip only costs what its tablets cost.
              {
                $multiply: [
                  "$lines.cost",
                  { $divide: ["$lines.units", { $max: [{ $ifNull: ["$lines.unitsPerPack", 1] }, 1] }] },
                ],
              },
            ],
          },
        },
        packs: { $sum: { $divide: ["$lines.units", { $max: [{ $ifNull: ["$lines.unitsPerPack", 1] }, 1] }] } },
      },
    },
    { $sort: { sales: -1 } },
    { $limit: 50 },
  ]);
  const soldIds = new Set(movers.map((m) => String(m._id)));

  const topSellers: Ranked[] = movers.slice(0, 8).map((m) => ({
    id: String(m._id),
    label: m.name,
    sublabel: `${Math.round(m.packs * 10) / 10}`,
    value: round2(m.sales),
  }));
  const topMargin: Ranked[] = [...movers]
    .sort((a, b) => b.margin - a.margin)
    .slice(0, 8)
    .map((m) => ({ id: String(m._id), label: m.name, value: round2(m.margin) }));

  // Dead stock: on the shelf, in date, but nothing sold in the window.
  const perPack = { $divide: ["$units", { $max: [{ $ifNull: ["$unitsPerPack", 1] }, 1] }] };
  const shelf = await ShopStock.aggregate<{ _id: mongoose.Types.ObjectId; name: string; qty: number; value: number }>([
    { $match: { businessId, units: { $gt: 0 }, expiryDate: { $gt: now } } },
    {
      $group: {
        _id: "$productId",
        name: { $last: "$name" },
        qty: { $sum: perPack },
        value: { $sum: { $multiply: [perPack, "$cost"] } },
      },
    },
    { $sort: { value: -1 } },
    { $limit: 200 },
  ]);
  const deadSince = new Date(now.getTime() - DEAD_STOCK_DAYS * DAY);
  const lastSold = await Bill.aggregate<{ _id: mongoose.Types.ObjectId; last: Date }>([
    { $match: { businessId, status: "final", createdAt: { $gte: deadSince } } },
    { $unwind: "$lines" },
    { $group: { _id: "$lines.productId", last: { $max: "$createdAt" } } },
  ]);
  const lastById = new Map(lastSold.map((r) => [String(r._id), r.last]));
  const dead = shelf
    .filter((s) => !lastById.has(String(s._id)) && !soldIds.has(String(s._id)))
    .slice(0, 20)
    .map((s) => ({
      productId: String(s._id),
      name: s.name,
      qty: Math.round(s.qty * 10) / 10,
      value: round2(s.value),
      lastSoldAt: null as string | null,
    }));

  // Customers: new in the window vs those who came back.
  const [customerRows] = await Bill.aggregate<{ ids: mongoose.Types.ObjectId[] }>([
    { $match: { businessId, status: "final", createdAt: { $gte: since }, customerId: { $ne: null } } },
    { $group: { _id: null, ids: { $addToSet: "$customerId" } } },
  ]);
  const activeIds = customerRows?.ids ?? [];
  const [newCount, lapsed, total] = await Promise.all([
    Customer.countDocuments({ businessId, status: "active", firstVisitAt: { $gte: since } }),
    Customer.countDocuments({ businessId, status: "active", lastVisitAt: { $lt: new Date(now.getTime() - 120 * DAY) } }),
    Customer.countDocuments({ businessId, status: "active" }),
  ]);

  const topCustomers = await Bill.aggregate<{ _id: mongoose.Types.ObjectId; spend: number; visits: number }>([
    { $match: { businessId, status: "final", createdAt: { $gte: since }, customerId: { $ne: null } } },
    { $group: { _id: "$customerId", spend: { $sum: "$totals.grandTotal" }, visits: { $sum: 1 } } },
    { $sort: { spend: -1 } },
    { $limit: 8 },
  ]);
  const names = await Customer.find({ _id: { $in: topCustomers.map((c) => c._id) } }, { name: 1 }).lean();
  const nameById = new Map(names.map((n) => [String(n._id), n.name]));

  // What expired on the shelf during the window, at cost.
  const [loss] = await ShopStock.aggregate<{ count: number; value: number }>([
    { $match: { businessId, units: { $gt: 0 }, expiryDate: { $gte: since, $lt: now } } },
    { $group: { _id: null, count: { $sum: 1 }, value: { $sum: { $multiply: [perPack, "$cost"] } } } },
  ]);

  // Output GST by rate, for the shop's monthly filing.
  const gstRows = await Bill.aggregate<{ _id: number; taxable: number; cgst: number; sgst: number }>([
    { $match: { businessId, status: "final", createdAt: { $gte: since } } },
    { $unwind: "$lines" },
    {
      $group: {
        _id: "$lines.gstRate",
        taxable: { $sum: "$lines.taxable" },
        cgst: { $sum: "$lines.cgst" },
        sgst: { $sum: "$lines.sgst" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return {
    days,
    sales: period(current.sales, prev.sales),
    margin: period(current.margin, prev.margin),
    bills: period(current.bills, prev.bills),
    averageBill: period(
      current.bills ? current.sales / current.bills : 0,
      prev.bills ? prev.sales / prev.bills : 0,
    ),
    marginPercent: current.sales > 0 ? Math.round((current.margin / current.sales) * 1000) / 10 : 0,
    daily,
    topSellers,
    topMargin,
    deadStock: dead,
    deadStockValue: round2(dead.reduce((a, d) => a + d.value, 0)),
    customers: {
      newCount,
      repeatCount: Math.max(activeIds.length - newCount, 0),
      lapsed,
      total,
      top: topCustomers.map((c) => ({
        id: String(c._id),
        label: nameById.get(String(c._id)) ?? "—",
        sublabel: `${c.visits}`,
        value: round2(c.spend),
      })),
    },
    expiryLoss: { count: loss?.count ?? 0, value: round2(loss?.value ?? 0) },
    gst: gstRows.map((r) => ({
      rate: r._id,
      taxable: round2(r.taxable),
      cgst: round2(r.cgst),
      sgst: round2(r.sgst),
    })),
  };
}
