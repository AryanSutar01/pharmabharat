import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectDB } from "@/lib/db/mongo";
import { Bill } from "@/lib/models/bill";
import { Business, requiredDocuments, type BusinessDoc } from "@/lib/models/business";
import { Customer } from "@/lib/models/customer";
import { Product } from "@/lib/models/product";
import { ShopItem, ShopStock } from "@/lib/models/shop-stock";
import { ShopSettings } from "@/lib/models/shop-settings";
import { createBill } from "@/lib/retail/billing";
import { addStock } from "@/lib/retail/stock";
import { businessProfileSchema } from "@/lib/validation/business";

const DAY = 24 * 3600 * 1000;
const USER = { id: "nogst-staff", name: "Counter Staff" };

/** A complete, valid profile; individual tests vary the tax fields. */
const profile = (over: Record<string, unknown>) => ({
  type: "retailer",
  legalName: "Small Medical Store",
  pan: "ABCDE1234F",
  phone: "9876543210",
  email: "small@example.invalid",
  address: { line1: "1 Test Road", city: "Nashik", stateCode: "27", pincode: "422001" },
  drugLicenses: [{ form: "20", number: "MH-20-1", validTill: new Date(Date.now() + 400 * DAY) }],
  pharmacist: { name: "Demo Pharmacist", registrationNumber: "MH-PH-1234" },
  ...over,
});

describe("shops without GST registration (integration, database: pharmabharat_test)", () => {
  let shop: BusinessDoc;
  let stockId: string;

  beforeAll(async () => {
    await connectDB();
    expect(mongoose.connection.db!.databaseName).toBe("pharmabharat_test");
    await mongoose.connection.db!.dropDatabase();
    await Promise.all(
      [Bill, Business, Customer, Product, ShopStock, ShopItem, ShopSettings].map((m) => m.createCollection()),
    );
    await Business.syncIndexes();

    const b = await Business.create({
      type: "retailer",
      legalName: "Small Medical Store",
      taxStatus: "unregistered",
      ownerUserId: "nogst-owner",
      address: { line1: "1 Test Road", city: "Nashik", stateCode: "27", pincode: "422001" },
      kyc: { status: "approved" },
    });
    shop = b.toObject() as BusinessDoc;

    const p = await Product.create({ name: "Nogstin 500 Tablet", manufacturer: "Test Labs", mrp: 105, source: "seller" });
    await addStock(
      shop._id,
      { productId: p._id, name: "Nogstin 500 Tablet", batchNo: "NG-1", expiryDate: new Date(Date.now() + 400 * DAY), qty: 100, unitsPerPack: 10, cost: 80, mrp: 105, gstRate: 5 },
      USER.id,
    );
    stockId = String((await ShopStock.findOne({ businessId: shop._id }).lean())!._id);
  });

  afterAll(async () => {
    await mongoose.connection.db?.dropDatabase();
    await mongoose.disconnect();
  });

  it("accepts a profile with no GSTIN when the business is unregistered", () => {
    const ok = businessProfileSchema.safeParse(profile({ taxStatus: "unregistered" }));
    expect(ok.success).toBe(true);
    expect(ok.data?.gstin).toBeUndefined();
  });

  it("still demands a GSTIN from a registered or composition business", () => {
    for (const taxStatus of ["registered", "composition"] as const) {
      const res = businessProfileSchema.safeParse(profile({ taxStatus }));
      expect(res.success).toBe(false);
      expect(res.error?.issues.find((i) => i.path[0] === "gstin")?.message).toBe("required");
    }
    // A valid one passes, and is still checked against the PAN and the state.
    const good = businessProfileSchema.safeParse(profile({ taxStatus: "composition", gstin: "27ABCDE1234F1Z0" }));
    expect(good.success).toBe(true);
  });

  it("refuses a GSTIN from someone who says they are unregistered", () => {
    const res = businessProfileSchema.safeParse(profile({ taxStatus: "unregistered", gstin: "27ABCDE1234F1Z0" }));
    expect(res.success).toBe(false);
    expect(res.error?.issues[0].message).toBe("gstin_not_expected");
  });

  it("does not ask an unregistered business for a GST certificate", () => {
    expect(requiredDocuments("retailer", "unregistered")).not.toContain("gst_certificate");
    expect(requiredDocuments("retailer", "composition")).toContain("gst_certificate");
    // The drug licence is never optional, whatever the tax position.
    for (const s of ["registered", "composition", "unregistered"] as const) {
      expect(requiredDocuments("retailer", s)).toContain("drug_license");
    }
  });

  it("lets two unregistered businesses exist side by side", async () => {
    // A sparse unique index on gstin would have been fine, but an empty string
    // would not — this proves neither shape collides.
    await Business.create({ type: "retailer", legalName: "Another Small Store", taxStatus: "unregistered", ownerUserId: "x", kyc: { status: "draft" } });
    await Business.collection.insertOne({ type: "retailer", legalName: "Third Store", taxStatus: "unregistered", gstin: "", ownerUserId: "y" } as never);
    expect(await Business.countDocuments({ taxStatus: "unregistered" })).toBe(3);
  });

  it("bills without charging any tax, as a Bill of Supply", async () => {
    const bill = await createBill(shop._id, { lines: [{ stockId, qty: 2 }] }, USER, "unregistered");

    expect(bill.documentType).toBe("bill_of_supply");
    expect(bill.taxStatus).toBe("unregistered");
    // The customer pays the same 2 × ₹105; none of it is tax.
    expect(bill.totals).toMatchObject({ grandTotal: 210, taxable: 210, cgst: 0, sgst: 0, tax: 0 });
    expect(bill.lines[0]).toMatchObject({ total: 210, taxable: 210, cgst: 0, sgst: 0 });
  });

  it("charges tax normally for a registered shop on the same stock", async () => {
    const bill = await createBill(shop._id, { lines: [{ stockId, qty: 2 }] }, USER, "registered");
    expect(bill.documentType).toBe("tax_invoice");
    expect(bill.totals).toMatchObject({ grandTotal: 210, taxable: 200, cgst: 5, sgst: 5 });
  });

  it("keeps a composition bill free of tax but marked as registered-under-composition", async () => {
    const bill = await createBill(shop._id, { lines: [{ stockId, qty: 1, discountPercent: 10 }] }, USER, "composition");
    expect(bill.documentType).toBe("bill_of_supply");
    expect(bill.taxStatus).toBe("composition");
    // 105 less 10% = 94.50, rounded to 95 payable, none of it tax.
    expect(bill.totals).toMatchObject({ cgst: 0, sgst: 0, grandTotal: 95 });
    expect(bill.lines[0].taxable).toBe(94.5);
  });

  it("freezes the document type, so registering later does not rewrite old bills", async () => {
    const before = await Bill.findOne({ businessId: shop._id, documentType: "bill_of_supply" }).lean();
    await Business.updateOne({ _id: shop._id }, { $set: { taxStatus: "registered" } });
    const after = await Bill.findById(before!._id).lean();
    expect(after!.documentType).toBe("bill_of_supply");
    expect(after!.totals?.cgst).toBe(0);
  });
});
