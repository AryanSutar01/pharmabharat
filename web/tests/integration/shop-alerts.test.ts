import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectDB } from "@/lib/db/mongo";
import { Bill } from "@/lib/models/bill";
import { Business, type BusinessDoc } from "@/lib/models/business";
import { Customer } from "@/lib/models/customer";
import { Membership } from "@/lib/models/membership";
import { Notification } from "@/lib/models/notification";
import { Product } from "@/lib/models/product";
import { ShopItem, ShopStock } from "@/lib/models/shop-stock";
import { ShopSettings } from "@/lib/models/shop-settings";
import { computeReorderLevels, expiringStock, lowStock, runShopAlerts, setReorderLevel } from "@/lib/retail/alerts";
import { createBill } from "@/lib/retail/billing";
import { addStock } from "@/lib/retail/stock";

const DAY = 24 * 3600 * 1000;
const USER = { id: "alerts-owner", name: "Owner" };

describe("shop alerts (integration, database: pharmabharat_test)", () => {
  let shop: BusinessDoc;
  let fast: mongoose.Types.ObjectId;
  let slow: mongoose.Types.ObjectId;
  let fastStock: string;

  beforeAll(async () => {
    await connectDB();
    expect(mongoose.connection.db!.databaseName).toBe("pharmabharat_test");
    await mongoose.connection.db!.dropDatabase();
    await Promise.all(
      [Bill, Business, Customer, Membership, Notification, Product, ShopStock, ShopItem, ShopSettings].map((m) =>
        m.createCollection(),
      ),
    );

    const b = await Business.create({
      type: "retailer",
      legalName: "Alert Pharmacy",
      ownerUserId: USER.id,
      address: { line1: "1 Test Road", city: "Test City", stateCode: "27", pincode: "411001" },
      kyc: { status: "approved" },
    });
    shop = b.toObject() as BusinessDoc;
    await Membership.create({ businessId: shop._id, userId: USER.id, role: "owner", status: "active" });

    const [p1, p2] = await Product.create([
      { name: "Fastmover 100 Tablet", manufacturer: "Test Labs", mrp: 105, source: "seller" },
      { name: "Slowmover 200 Tablet", manufacturer: "Test Labs", mrp: 210, source: "seller" },
    ]);
    fast = p1._id;
    slow = p2._id;

    // Batches at different distances from expiry.
    const batches: [mongoose.Types.ObjectId, string, number, number][] = [
      [fast, "F-400", 400, 100], // the fast mover, far from expiry
      [slow, "S-45", 45, 60], // expiring inside 60 days
      [slow, "S-20", 20, 10], // inside 30 days
      [slow, "S-PAST", -5, 4], // already expired
    ];
    for (const [productId, batchNo, days, qty] of batches) {
      await addStock(
        shop._id,
        {
          productId,
          name: productId.equals(fast) ? "Fastmover 100 Tablet" : "Slowmover 200 Tablet",
          batchNo,
          expiryDate: new Date(Date.now() + days * DAY),
          qty,
          cost: 80,
          mrp: 105,
          gstRate: 5,
        },
        USER.id,
      );
    }
    fastStock = String((await ShopStock.findOne({ businessId: shop._id, batchNo: "F-400" }).lean())!._id);
  });

  afterAll(async () => {
    await mongoose.connection.db?.dropDatabase();
    await mongoose.disconnect();
  });

  it("buckets expiring stock and values what is at risk", async () => {
    const rows = await expiringStock(shop._id);
    expect(rows.map((r) => r.bucket)).toEqual(["expired", "30", "60"].map((b) => (b === "expired" ? "expired" : Number(b))));
    expect(rows[0]).toMatchObject({ batchNo: "S-PAST", value: 320 });
    expect(rows.map((r) => r.batchNo)).toEqual(["S-PAST", "S-20", "S-45"]);
    // The 400-day batch is far off and not listed at all.
    expect(rows.some((r) => r.batchNo === "F-400")).toBe(false);
  });

  it("sets reorder levels from how fast a medicine actually sells", async () => {
    // 90 packs over the 90-day window → one a day.
    for (let i = 0; i < 9; i++) {
      const bill = await createBill(shop._id, { lines: [{ stockId: fastStock, qty: 10 }] }, USER);
      await Bill.collection.updateOne({ _id: bill._id }, { $set: { createdAt: new Date(Date.now() - (i * 7 + 1) * DAY) } });
    }
    await computeReorderLevels(shop._id);

    const item = await ShopItem.findOne({ businessId: shop._id, productId: fast }).lean();
    expect(item!.dailySales).toBeCloseTo(1, 2);
    expect(item!.reorderLevel).toBe(15); // 15 days of cover, the default

    const slowItem = await ShopItem.findOne({ businessId: shop._id, productId: slow }).lean();
    expect(slowItem).toMatchObject({ dailySales: 0, reorderLevel: 0 });
  });

  it("lists what is running low, with a suggested order", async () => {
    const rows = await lowStock(shop._id);
    expect(rows).toHaveLength(1);
    // 100 packs came in, 90 sold, 10 left — below the level of 15.
    expect(rows[0]).toMatchObject({ name: "Fastmover 100 Tablet", inStock: 10, reorderLevel: 15, suggestedQty: 5 });
    expect(rows[0].daysLeft).toBe(10);
  });

  it("respects a minimum the shop typed itself", async () => {
    // 70 sellable packs of the slow mover, so a minimum of 100 makes it low.
    await setReorderLevel(shop._id, String(slow), 100);
    const rows = await lowStock(shop._id);
    expect(rows.map((r) => r.name).sort()).toEqual(["Fastmover 100 Tablet", "Slowmover 200 Tablet"]);

    // Recomputing must not overwrite it.
    await computeReorderLevels(shop._id);
    expect((await ShopItem.findOne({ businessId: shop._id, productId: slow }).lean())!.reorderLevel).toBe(100);

    await setReorderLevel(shop._id, String(slow), null);
    await computeReorderLevels(shop._id);
    expect((await ShopItem.findOne({ businessId: shop._id, productId: slow }).lean())!.reorderLevel).toBe(0);
  });

  it("warns once per expiry level, and nudges about low stock", async () => {
    const first = await runShopAlerts(shop._id);
    expect(first).toMatchObject({ expiring: 2, low: 1 }); // the 45-day and 20-day batches
    const kinds = await Notification.find({ businessId: shop._id }).lean();
    expect(kinds.map((k) => k.kind).sort()).toEqual(["shop_expiry", "shop_low_stock"]);
    expect(kinds.find((k) => k.kind === "shop_expiry")!.params).toMatchObject({ count: 2, days: 30 });

    // Running again the same day says nothing new about expiry.
    expect((await runShopAlerts(shop._id)).expiring).toBe(0);
  });
});
