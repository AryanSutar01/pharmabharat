// Creates two clearly-labelled DEMO distributors with listings for common
// medicines, so search, margin comparison and substitutes can be tried
// before real sellers onboard. Development only.
//
//   node scripts/seed-demo.mts            # create / refresh demo data
//   node scripts/seed-demo.mts --remove   # delete all demo businesses + their listings

import { readFileSync } from "node:fs";
import { MongoClient } from "mongodb";

const DEMO_OWNER = "demo-seed";

const SELLERS = [
  { key: "pune", legalName: "[DEMO] Sahyadri Pharma Distributors", city: "Pune", stateCode: "27", pincode: "411001", marginBias: 0 },
  { key: "ahmedabad", legalName: "[DEMO] Sabarmati Medico Agencies", city: "Ahmedabad", stateCode: "24", pincode: "380009", marginBias: 3 },
];

// Brand names as they appear in the medicine master.
const PRODUCTS = [
  "Dolo 650 Tablet",
  "Crocin Advance Tablet",
  "Calpol 650 Tablet",
  "Augmentin 625 Duo Tablet",
  "Azithral 500 Tablet",
  "Pan 40 Tablet",
  "Pantocid 40 Tablet",
  "Glycomet 500 SR Tablet",
  "Telma 40 Tablet",
  "Amlong 5 Tablet",
  "Atorva 10 Tablet",
  "Montair LC Tablet",
  "Allegra 120mg Tablet",
  "Ascoril LS Syrup",
  "Thyronorm 50mcg Tablet",
  "Shelcal 500 Tablet",
  "Zerodol-SP Tablet",
  "Cetzine 10mg Tablet",
  "Ecosprin 75 Tablet",
  "Rosuvas 10 Tablet",
];

function loadEnv() {
  const env: Record<string, string> = {};
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return { uri: env.MONGODB_URI, db: env.MONGODB_DB || "pharmabharat" };
}

// Deterministic pseudo-random so re-runs produce the same prices.
function seeded(n: number) {
  const x = Math.sin(n * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

async function main() {
  const { uri, db: dbName } = loadEnv();
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const businesses = db.collection("businesses");
  const listings = db.collection("listings");

  const existing = await businesses.find({ ownerUserId: DEMO_OWNER }, { projection: { _id: 1 } }).toArray();
  if (process.argv.includes("--remove")) {
    const ids = existing.map((b) => b._id);
    const l = await listings.deleteMany({ sellerId: { $in: ids } });
    const b = await businesses.deleteMany({ _id: { $in: ids } });
    console.log(`removed ${b.deletedCount} demo businesses and ${l.deletedCount} listings`);
    await client.close();
    return;
  }

  const now = new Date();
  let listingCount = 0;
  for (const [si, s] of SELLERS.entries()) {
    const res = await businesses.findOneAndUpdate(
      { ownerUserId: DEMO_OWNER, legalName: s.legalName },
      {
        $set: {
          type: "wholesaler",
          tradeName: s.legalName,
          phone: "9000000000",
          email: `demo-${s.key}@example.invalid`,
          address: { line1: "Sample address (demo data)", city: s.city, stateCode: s.stateCode, pincode: s.pincode },
          drugLicenses: [{ form: "20B", number: `DEMO-${s.key.toUpperCase()}-20B`, validTill: new Date("2030-12-31") }],
          documents: [],
          kyc: { status: "approved", reviewedAt: now, reviewedBy: DEMO_OWNER, remarks: "Demo data" },
          updatedAt: now,
        },
        $setOnInsert: { legalName: s.legalName, ownerUserId: DEMO_OWNER, createdAt: now },
      },
      { upsert: true, returnDocument: "after" },
    );
    const seller = res!;

    for (const [pi, name] of PRODUCTS.entries()) {
      const product = await db
        .collection("products")
        .findOne({ name, active: true }, { collation: { locale: "en", strength: 2 } });
      if (!product?.mrp) {
        if (si === 0) console.log(`  (skipped, not in master: ${name})`);
        continue;
      }
      const margin = 0.16 + seeded(pi * 7 + si) * 0.14 + s.marginBias / 100; // 16–33%
      const price = Math.round(product.mrp * (1 - margin) * 100) / 100;
      const expiry = new Date(Date.UTC(2027 + ((pi + si) % 2), (pi * 3 + si) % 12, 28));
      await listings.updateOne(
        { sellerId: seller._id, productId: product._id, batchNo: `DEMO${String(pi).padStart(3, "0")}` },
        {
          $set: {
            mrp: product.mrp,
            price,
            gstRate: 5,
            hsn: "3004",
            expiryDate: expiry,
            stock: 50 + Math.round(seeded(pi + si * 31) * 450),
            minOrderQty: 5,
            storage: "room",
            schedule: "h",
            conditions: [],
            status: "active",
            sellerStateCode: s.stateCode,
            updatedAt: now,
          },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true },
      );
      listingCount++;
    }
  }
  console.log(`demo: ${SELLERS.length} distributors, ${listingCount} listings (remove with --remove)`);
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

