import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buyerDashboard, platformOverview, sellerDashboard } from "@/lib/analytics";
import { connectDB } from "@/lib/db/mongo";
import { Business, type BusinessDoc } from "@/lib/models/business";
import { Cart } from "@/lib/models/cart";
import { Listing } from "@/lib/models/listing";
import { Order } from "@/lib/models/order";
import { Product } from "@/lib/models/product";
import { placeOrders, transitionOrder } from "@/lib/orders/service";

const DAY = 24 * 3600 * 1000;
const USER = "analytics-user";

describe("dashboards (integration, database: pharmabharat_test)", () => {
  let buyer: BusinessDoc;
  let seller: BusinessDoc;

  beforeAll(async () => {
    await connectDB();
    expect(mongoose.connection.db!.databaseName).toBe("pharmabharat_test");
    await mongoose.connection.db!.dropDatabase();
    await Promise.all([Business, Cart, Listing, Order, Product].map((m) => m.createCollection()));
    const mk = async (name: string, type: "retailer" | "wholesaler") =>
      (
        await Business.create({
          type,
          legalName: name,
          ownerUserId: USER,
          address: { line1: "x", city: "Pune", stateCode: "27", pincode: "411001" },
          kyc: { status: "approved" },
        })
      ).toObject() as BusinessDoc;
    buyer = await mk("Dash Retail", "retailer");
    seller = await mk("Dash Wholesale", "wholesaler");

    const p1 = await Product.create({ name: "Alpha 500 Tablet", manufacturer: "X", mrp: 100, source: "seller" });
    const p2 = await Product.create({ name: "Beta Syrup", manufacturer: "Y", mrp: 50, source: "seller" });
    const base = { sellerId: seller._id, expiryDate: new Date(Date.now() + 60 * DAY), gstRate: 5, hsn: "3004", schedule: "h", sellerStateCode: "27" } as const;
    const l1 = await Listing.create({ ...base, productId: p1._id, batchNo: "A1", mrp: 100, price: 80, stock: 100 });
    const l2 = await Listing.create({ ...base, productId: p2._id, batchNo: "B1", mrp: 50, price: 40, stock: 5 });

    // Order 1: 10 × Alpha (₹800 + 5% GST = ₹840)
    await Cart.create({ businessId: buyer._id, userId: USER, items: [{ listingId: l1._id, qty: 10 }] });
    await placeOrders({ buyer, userId: USER, paymentMode: "credit" });
    // Order 2: 2 × Beta (₹80 + ₹4 = ₹84)
    await Cart.updateOne({ businessId: buyer._id, userId: USER }, { $set: { items: [{ listingId: l2._id, qty: 2 }] } });
    await placeOrders({ buyer, userId: USER, paymentMode: "cod" });
    // Order 3: cancelled → must not count
    await Cart.updateOne({ businessId: buyer._id, userId: USER }, { $set: { items: [{ listingId: l1._id, qty: 5 }] } });
    const { orders } = await placeOrders({ buyer, userId: USER, paymentMode: "cod" });
    await transitionOrder({ orderId: orders[0]._id, action: "cancel", userId: USER });
  });

  afterAll(async () => {
    await mongoose.connection.db?.dropDatabase();
    await mongoose.disconnect();
  });

  it("seller: revenue, orders, top products and stock health (cancelled orders excluded)", async () => {
    const d = await sellerDashboard(seller._id);
    expect(d.revenue.current).toBe(924); // 840 + 84
    expect(d.orders.current).toBe(2);
    expect(d.avgOrder.current).toBe(462);
    expect(d.revenue.change).toBeNull(); // no previous period to compare against
    expect(d.daily).toHaveLength(30);
    expect(d.daily.at(-1)!.value).toBe(924); // all placed today
    expect(d.topProducts.map((p) => p.label)).toEqual(["Alpha 500 Tablet", "Beta Syrup"]);
    expect(d.topProducts[0]).toMatchObject({ value: 800, sublabel: "10" });
    expect(d.pipeline).toMatchObject({ placed: 2 });
    // Beta: 5 - 2 = 3 left → low stock; both expire within 90 days.
    expect(d.stock).toMatchObject({ active: 2, low: 1, out: 0, expiring: 2 });
  });

  it("buyer: spend, savings vs MRP and suppliers", async () => {
    const d = await buyerDashboard(buyer._id);
    expect(d.spend.current).toBe(924);
    expect(d.orders.current).toBe(2);
    // Saved (100-80)*10 + (50-40)*2 = 220 on an MRP value of 1,100 → 20%.
    expect(d.saved).toBe(220);
    expect(d.savedPct).toBe(20);
    expect(d.topSuppliers).toEqual([expect.objectContaining({ label: "Dash Wholesale", value: 924, sublabel: "2" })]);
    expect(d.openOrders).toBe(2);
  });

  it("platform overview counts verified businesses and GMV", async () => {
    const d = await platformOverview();
    expect(d.gmv.current).toBe(924);
    expect(d.verifiedByType).toMatchObject({ retailer: 1, wholesaler: 1 });
    expect(d.businessesByStatus.approved).toBe(2);
  });
});
