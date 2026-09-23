import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { offerSummaries } from "@/lib/catalog/queries";
import { runLicenceChecks } from "@/lib/compliance/service";
import { connectDB } from "@/lib/db/mongo";
import { Business, type BusinessDoc } from "@/lib/models/business";
import { Listing } from "@/lib/models/listing";
import { Membership } from "@/lib/models/membership";
import { Notification } from "@/lib/models/notification";
import { Product } from "@/lib/models/product";

const DAY = 24 * 3600 * 1000;
const future = new Date(Date.now() + 400 * DAY);

async function seller(name: string, validTill: Date) {
  const b = await Business.create({
    type: "wholesaler",
    legalName: name,
    ownerUserId: `${name}-owner`,
    address: { line1: "1 Test Road", city: "Test City", stateCode: "27", pincode: "411001" },
    drugLicenses: [
      { form: "20B", number: "MH-20B-1", validTill },
      { form: "21B", number: "MH-21B-1", validTill: new Date(validTill.getTime() + 200 * DAY) },
    ],
    kyc: { status: "approved" },
  });
  await Membership.create({ businessId: b._id, userId: `${name}-owner`, role: "owner", status: "active" });
  return b.toObject() as BusinessDoc;
}

describe("licence expiry (integration, database: pharmabharat_test)", () => {
  let expiring: BusinessDoc;
  let lapsed: BusinessDoc;
  let productId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await connectDB();
    expect(mongoose.connection.db!.databaseName).toBe("pharmabharat_test");
    await mongoose.connection.db!.dropDatabase();
    await Promise.all([Business, Listing, Membership, Notification, Product].map((m) => m.createCollection()));

    expiring = await seller("Expiring Distributors", new Date(Date.now() + 25 * DAY));
    lapsed = await seller("Lapsed Distributors", new Date(Date.now() - 2 * DAY));
    const p = await Product.create({ name: "Licencil 100 Tablet", manufacturer: "Test Labs", mrp: 100, source: "seller" });
    productId = p._id;

    for (const b of [expiring, lapsed]) {
      await Listing.create({
        sellerId: b._id,
        productId,
        batchNo: `L-${b.legalName.slice(0, 3)}`,
        expiryDate: future,
        mrp: 100,
        price: b._id.equals(lapsed._id) ? 50 : 70, // the lapsed seller is cheapest
        gstRate: 5,
        hsn: "3004",
        stock: 20,
        minOrderQty: 1,
        schedule: "h",
        sellerStateCode: "27",
      });
    }
  });

  afterAll(async () => {
    await mongoose.connection.db?.dropDatabase();
    await mongoose.disconnect();
  });

  it("warns before expiry and suspends afterwards", async () => {
    const run = await runLicenceChecks();
    expect(run).toMatchObject({ checked: 2, warned: 1, suspended: 1 });

    const warnedDoc = await Business.findById(expiring._id).lean();
    expect(warnedDoc!.kyc?.status).toBe("approved");
    expect(warnedDoc!.compliance?.licenceWarnLevel).toBe(30);

    const suspendedDoc = await Business.findById(lapsed._id).lean();
    expect(suspendedDoc!.kyc?.status).toBe("suspended");
    expect(suspendedDoc!.kyc?.remarks).toContain("20B");

    const notes = await Notification.find({ kind: "licence_expiring" }).lean();
    expect(notes).toHaveLength(2);
  });

  it("does not repeat the same warning the next day", async () => {
    expect(await runLicenceChecks()).toMatchObject({ warned: 0, suspended: 0 });
    expect(await Notification.countDocuments({ kind: "licence_expiring" })).toBe(2);
  });

  it("keeps a suspended seller's listings out of the catalogue's best price", async () => {
    const summaries = await offerSummaries([productId]);
    const summary = summaries.get(String(productId));
    // The lapsed seller was cheaper at 50, but must no longer count.
    expect(summary).toMatchObject({ bestPrice: 70, sellers: 1 });
  });

  it("warns again at the next level as the date gets closer", async () => {
    await Business.updateOne(
      { _id: expiring._id },
      { $set: { "drugLicenses.0.validTill": new Date(Date.now() + 5 * DAY) } },
    );
    expect(await runLicenceChecks()).toMatchObject({ warned: 1 });
    expect((await Business.findById(expiring._id).lean())!.compliance?.licenceWarnLevel).toBe(7);
  });
});
