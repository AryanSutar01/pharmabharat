// Moves a shop's shelf from whole packs to the smallest sellable unit, so a
// chemist can cut a strip. See lib/retail/units.ts.
//
// Before: shopstocks.qty = packs
// After:  shopstocks.units = tablets, shopstocks.unitsPerPack = tablets per pack
//
// Existing rows are migrated as indivisible (unitsPerPack = 1), which keeps
// every number exactly as it was: 12 packs stays 12 units of a 1-unit pack.
// The shop then sets the real pack size per batch when it next receives stock,
// or on the stock page. Nothing is guessed here — a wrong pack size would make
// the shelf lie about how many tablets it holds.
//
//   node scripts/migrate-shop-units.mts            # show what would change
//   node scripts/migrate-shop-units.mts --apply    # do it

import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;
if (!uri || !dbName) {
  console.error("Set MONGODB_URI and MONGODB_DB (see .env.local).");
  process.exit(1);
}

const apply = process.argv.includes("--apply");
const client = new MongoClient(uri);

try {
  await client.connect();
  const db = client.db(dbName);
  const stock = db.collection("shopstocks");
  const bills = db.collection("bills");

  const needsStock = await stock.countDocuments({ units: { $exists: false } });
  const needsBills = await bills.countDocuments({ "lines.units": { $exists: false } });
  console.log(`shop stock rows to migrate: ${needsStock}`);
  console.log(`bills to backfill:          ${needsBills}`);

  if (!apply) {
    console.log("\nDry run. Re-run with --apply to write the changes.");
    process.exit(0);
  }

  if (needsStock) {
    const renamed = await stock.updateMany({ units: { $exists: false } }, { $rename: { qty: "units" } });
    const defaulted = await stock.updateMany(
      { unitsPerPack: { $exists: false } },
      { $set: { unitsPerPack: 1 } },
    );
    console.log(`renamed qty → units on ${renamed.modifiedCount}; set unitsPerPack on ${defaulted.modifiedCount}`);
  }

  if (needsBills) {
    // Old bill lines sold whole packs at the pack MRP.
    const res = await bills.updateMany({ "lines.units": { $exists: false } }, [
      {
        $set: {
          lines: {
            $map: {
              input: "$lines",
              as: "l",
              in: {
                $mergeObjects: [
                  "$$l",
                  { saleUnit: "pack", unitsPerPack: 1, units: "$$l.qty", rate: "$$l.mrp" },
                ],
              },
            },
          },
        },
      },
    ]);
    console.log(`backfilled ${res.modifiedCount} bills`);
  }

  console.log("\nDone. Set the real pack size (tablets per strip) per batch on /app/shop/stock.");
} finally {
  await client.close();
}
