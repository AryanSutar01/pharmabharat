import "server-only";
import { connectDB } from "@/lib/db/mongo";
import { computeReorderLevels, runShopAlerts, shopIds } from "@/lib/retail/alerts";
import { purgeInactiveCustomers } from "@/lib/retail/customers";
import { runRefillReminders } from "@/lib/retail/refills";

/**
 * Daily housekeeping for every shop: reorder levels from how fast things sell,
 * expiry and low-stock alerts, and the DPDP retention purge. One shop failing
 * must not stop the rest.
 */
export async function runShopHousekeeping(now = new Date()) {
  await connectDB();
  const shops = await shopIds();
  let purged = 0;
  let expiring = 0;
  let low = 0;
  let refills = 0;
  for (const id of shops) {
    try {
      await computeReorderLevels(id, now);
      const alerts = await runShopAlerts(id, now);
      expiring += alerts.expiring;
      low += alerts.low;
      refills += (await runRefillReminders(id, now)).emailed;
      purged += await purgeInactiveCustomers(id, now);
    } catch (err) {
      console.error("shop housekeeping failed", String(id), err);
    }
  }
  return { shops: shops.length, expiring, low, refills, purged };
}
