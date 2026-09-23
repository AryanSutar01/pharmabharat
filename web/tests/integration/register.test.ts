import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectDB } from "@/lib/db/mongo";
import { Bill } from "@/lib/models/bill";
import { Business, type BusinessDoc } from "@/lib/models/business";
import { Customer } from "@/lib/models/customer";
import { Product } from "@/lib/models/product";
import { ShopItem, ShopStock } from "@/lib/models/shop-stock";
import { createBill } from "@/lib/retail/billing";
import { createCustomer } from "@/lib/retail/customers";
import { customerPrescriptions, registerCsv, registerRows } from "@/lib/retail/register";
import { addStock } from "@/lib/retail/stock";

const DAY = 24 * 3600 * 1000;
const USER = { id: "reg-staff", name: "Counter Staff" };

describe("Schedule H register (integration, database: pharmabharat_test)", () => {
  let shop: BusinessDoc;
  let h1Stock: string;
  let otcStock: string;
  let customerId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await connectDB();
    expect(mongoose.connection.db!.databaseName).toBe("pharmabharat_test");
    await mongoose.connection.db!.dropDatabase();
    await Promise.all([Bill, Business, Customer, Product, ShopStock, ShopItem].map((m) => m.createCollection()));

    const b = await Business.create({
      type: "retailer",
      legalName: "Register Pharmacy",
      ownerUserId: "reg-owner",
      address: { line1: "1 Test Road", city: "Test City", stateCode: "27", pincode: "411001" },
      kyc: { status: "approved" },
    });
    shop = b.toObject() as BusinessDoc;

    const [p1, p2] = await Product.create([
      { name: "Alprax 0.5 Tablet", manufacturer: "Test Labs", mrp: 105, source: "seller" },
      { name: "Paracip 500 Tablet", manufacturer: "Test Labs", mrp: 105, source: "seller" },
    ]);
    await addStock(
      shop._id,
      { productId: p1._id, name: "Alprax 0.5 Tablet", batchNo: "H1-1", expiryDate: new Date(Date.now() + 400 * DAY), qty: 50, cost: 80, mrp: 105, gstRate: 5, schedule: "h1" },
      USER.id,
    );
    await addStock(
      shop._id,
      { productId: p2._id, name: "Paracip 500 Tablet", batchNo: "OTC-1", expiryDate: new Date(Date.now() + 400 * DAY), qty: 50, cost: 80, mrp: 105, gstRate: 5, schedule: "otc" },
      USER.id,
    );
    const stocks = await ShopStock.find({ businessId: shop._id }).lean();
    h1Stock = String(stocks.find((s) => s.batchNo === "H1-1")!._id);
    otcStock = String(stocks.find((s) => s.batchNo === "OTC-1")!._id);

    const { customer } = await createCustomer(shop._id, { name: "Asha Patil", phone: "9876543210", consent: true }, USER.id);
    customerId = customer._id;
  });

  afterAll(async () => {
    await mongoose.connection.db?.dropDatabase();
    await mongoose.disconnect();
  });

  it("records only scheduled medicines, with the prescriber", async () => {
    await createBill(
      shop._id,
      {
        lines: [
          { stockId: h1Stock, qty: 2 },
          { stockId: otcStock, qty: 1 },
        ],
        customerId: String(customerId),
        prescription: { doctorName: "Dr A Sharma", registrationNo: "MH-12345", patientName: "Asha Patil" },
      },
      USER,
    );

    const rows = await registerRows(shop._id, { from: new Date(Date.now() - DAY), to: new Date(Date.now() + DAY) });
    expect(rows).toHaveLength(1); // the over-the-counter line is not in the register
    expect(rows[0]).toMatchObject({
      medicine: "Alprax 0.5 Tablet",
      schedule: "H1",
      qty: 2,
      doctorName: "Dr A Sharma",
      registrationNo: "MH-12345",
      patientName: "Asha Patil",
      incomplete: false,
    });
  });

  it("flags a scheduled sale with no prescriber", async () => {
    await createBill(shop._id, { lines: [{ stockId: h1Stock, qty: 1 }] }, USER);
    const rows = await registerRows(shop._id, { from: new Date(Date.now() - DAY), to: new Date(Date.now() + DAY) });
    expect(rows.filter((r) => r.incomplete)).toHaveLength(1);
  });

  it("exports a CSV with a header and one row per dispensing", async () => {
    const rows = await registerRows(shop._id, { from: new Date(Date.now() - DAY), to: new Date(Date.now() + DAY) });
    const csv = registerCsv(rows);
    const lines = csv.split("\n");
    expect(lines[0]).toContain("Prescriber");
    expect(lines).toHaveLength(rows.length + 1);
    expect(lines[1]).toContain("Alprax 0.5 Tablet");
  });

  it("shows a customer's prescriptions on their profile", async () => {
    const list = await customerPrescriptions(shop._id, String(customerId));
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ doctorName: "Dr A Sharma", medicines: ["Alprax 0.5 Tablet × 2"] });
  });

  it("keeps the period tight", async () => {
    const lastMonth = { from: new Date(Date.now() - 60 * DAY), to: new Date(Date.now() - 30 * DAY) };
    expect(await registerRows(shop._id, lastMonth)).toHaveLength(0);
  });
});
