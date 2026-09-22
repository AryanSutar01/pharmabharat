import "server-only";
import mongoose from "mongoose";
import { connectDB, mongoDb } from "@/lib/db/mongo";
import { Business } from "@/lib/models/business";
import { Message } from "@/lib/models/chat";
import { Listing } from "@/lib/models/listing";
import { Order } from "@/lib/models/order";
import { Ticket } from "@/lib/models/ticket";
import { round2 } from "@/lib/orders/gst";
import { ACTIVE_STATUSES } from "@/lib/support/constants";

const DAY = 24 * 3600 * 1000;
const TZ = "Asia/Kolkata";
/** Orders that count towards revenue / spend. */
const COUNTED = { status: { $nin: ["rejected", "cancelled"] } };

export type DailyPoint = { date: string; value: number };
export type Ranked = { id: string; label: string; sublabel?: string; value: number };

/** Current vs previous window; `change` is % (null when there's no baseline). */
export type Period = { current: number; previous: number; change: number | null };

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

async function dailyTotals(match: Record<string, unknown>, since: Date, now: Date, days: number): Promise<DailyPoint[]> {
  const rows = await Order.aggregate<{ _id: string; v: number }>([
    { $match: { ...match, ...COUNTED, createdAt: { $gte: since } } },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: TZ } }, v: { $sum: "$totals.grandTotal" } } },
  ]);
  const byDay = new Map(rows.map((r) => [r._id, r.v]));
  return dayKeys(now, days).map((date) => ({ date, value: round2(byDay.get(date) ?? 0) }));
}

async function sumAndCount(match: Record<string, unknown>, from: Date, to: Date) {
  const [r] = await Order.aggregate<{ total: number; n: number }>([
    { $match: { ...match, ...COUNTED, createdAt: { $gte: from, $lt: to } } },
    { $group: { _id: null, total: { $sum: "$totals.grandTotal" }, n: { $sum: 1 } } },
  ]);
  return { total: r?.total ?? 0, n: r?.n ?? 0 };
}

// ---------------------------------------------------------------- seller

export async function sellerDashboard(sellerId: mongoose.Types.ObjectId, now = new Date(), days = 30) {
  await connectDB();
  const since = new Date(now.getTime() - days * DAY);
  const before = new Date(since.getTime() - days * DAY);
  const match = { sellerId };

  const [cur, prev, daily, pipeline, top, stock] = await Promise.all([
    sumAndCount(match, since, now),
    sumAndCount(match, before, since),
    dailyTotals(match, since, now, days),
    Order.aggregate<{ _id: string; n: number }>([
      { $match: { sellerId, status: { $in: ["placed", "accepted", "packed", "dispatched"] } } },
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]),
    Order.aggregate<{ _id: mongoose.Types.ObjectId; name: string; revenue: number; qty: number }>([
      { $match: { sellerId, ...COUNTED, createdAt: { $gte: since } } },
      { $unwind: "$items" },
      { $group: { _id: "$items.productId", name: { $first: "$items.name" }, revenue: { $sum: "$items.taxable" }, qty: { $sum: "$items.qty" } } },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]),
    Listing.aggregate<{ active: number; out: number; low: number; expiring: number }>([
      { $match: { sellerId } },
      {
        $group: {
          _id: null,
          active: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "active"] }, { $gt: ["$stock", 0] }] }, 1, 0] } },
          out: { $sum: { $cond: [{ $eq: ["$stock", 0] }, 1, 0] } },
          low: { $sum: { $cond: [{ $and: [{ $gt: ["$stock", 0] }, { $lte: ["$stock", 10] }] }, 1, 0] } },
          expiring: {
            $sum: {
              $cond: [
                { $and: [{ $gt: ["$stock", 0] }, { $lte: ["$expiryDate", new Date(now.getTime() + 90 * DAY)] }] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
  ]);

  return {
    revenue: period(cur.total, prev.total),
    orders: period(cur.n, prev.n),
    avgOrder: period(cur.n ? cur.total / cur.n : 0, prev.n ? prev.total / prev.n : 0),
    daily,
    pipeline: Object.fromEntries(pipeline.map((p) => [p._id, p.n])) as Record<string, number>,
    topProducts: top.map<Ranked>((t) => ({ id: String(t._id), label: t.name, sublabel: `${t.qty}`, value: round2(t.revenue) })),
    stock: stock[0] ?? { active: 0, out: 0, low: 0, expiring: 0 },
  };
}

// ---------------------------------------------------------------- buyer

export async function buyerDashboard(buyerId: mongoose.Types.ObjectId, now = new Date(), days = 30) {
  await connectDB();
  const since = new Date(now.getTime() - days * DAY);
  const before = new Date(since.getTime() - days * DAY);
  const match = { buyerId };

  const [cur, prev, daily, savings, suppliers, open] = await Promise.all([
    sumAndCount(match, since, now),
    sumAndCount(match, before, since),
    dailyTotals(match, since, now, days),
    // Savings vs MRP = what retail MRP would have been minus what was paid (both excl. GST).
    Order.aggregate<{ saved: number; mrpValue: number }>([
      { $match: { buyerId, ...COUNTED, createdAt: { $gte: since } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: null,
          saved: { $sum: { $multiply: [{ $subtract: ["$items.mrp", "$items.price"] }, "$items.qty"] } },
          mrpValue: { $sum: { $multiply: ["$items.mrp", "$items.qty"] } },
        },
      },
    ]),
    Order.aggregate<{ _id: mongoose.Types.ObjectId; name: string; spend: number; n: number }>([
      { $match: { buyerId, ...COUNTED, createdAt: { $gte: since } } },
      { $group: { _id: "$sellerId", name: { $first: "$seller.name" }, spend: { $sum: "$totals.grandTotal" }, n: { $sum: 1 } } },
      { $sort: { spend: -1 } },
      { $limit: 5 },
    ]),
    Order.countDocuments({ buyerId, status: { $in: ["placed", "accepted", "packed", "dispatched"] } }),
  ]);

  const s = savings[0];
  return {
    spend: period(cur.total, prev.total),
    orders: period(cur.n, prev.n),
    saved: round2(s?.saved ?? 0),
    savedPct: s?.mrpValue ? Math.round((s.saved / s.mrpValue) * 1000) / 10 : 0,
    daily,
    topSuppliers: suppliers.map<Ranked>((x) => ({ id: String(x._id), label: x.name, sublabel: `${x.n}`, value: round2(x.spend) })),
    openOrders: open,
  };
}

// ---------------------------------------------------------------- platform (admin)

export async function platformOverview(now = new Date(), days = 30) {
  await connectDB();
  const since = new Date(now.getTime() - days * DAY);
  const before = new Date(since.getTime() - days * DAY);
  const [byStatus, byType, cur, prev, daily, users, openTickets, reported] = await Promise.all([
    Business.aggregate<{ _id: string; n: number }>([{ $group: { _id: "$kyc.status", n: { $sum: 1 } } }]),
    Business.aggregate<{ _id: string; n: number }>([{ $match: { "kyc.status": "approved" } }, { $group: { _id: "$type", n: { $sum: 1 } } }]),
    sumAndCount({}, since, now),
    sumAndCount({}, before, since),
    dailyTotals({}, since, now, days),
    mongoDb().collection("user").countDocuments(),
    Ticket.countDocuments({ status: { $in: ACTIVE_STATUSES } }),
    Message.countDocuments({ "reports.0": { $exists: true }, hidden: false }),
  ]);
  return {
    businessesByStatus: Object.fromEntries(byStatus.map((r) => [r._id ?? "draft", r.n])) as Record<string, number>,
    verifiedByType: Object.fromEntries(byType.map((r) => [r._id, r.n])) as Record<string, number>,
    gmv: period(cur.total, prev.total),
    orders: period(cur.n, prev.n),
    daily,
    users,
    openTickets,
    reported,
  };
}
