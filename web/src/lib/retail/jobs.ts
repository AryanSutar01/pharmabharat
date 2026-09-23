import "server-only";
import { connectDB } from "@/lib/db/mongo";
import { Business } from "@/lib/models/business";
import { purgeInactiveCustomers } from "@/lib/retail/customers";

/**
 * Daily housekeeping for every shop: DPDP retention. Customers who stopped
 * coming longer ago than the shop's retention window lose their contact
 * details; the bills stay, anonymised.
 */
export async function runShopHousekeeping(now = new Date()) {
  await connectDB();
  const shops = await Business.find({ type: "retailer", "kyc.status": "approved" }, { _id: 1 }).limit(500).lean();
  let purged = 0;
  for (const shop of shops) {
    try {
      purged += await purgeInactiveCustomers(shop._id, now);
    } catch (err) {
      console.error("customer purge failed", String(shop._id), err);
    }
  }
  return { shops: shops.length, purged };
}
