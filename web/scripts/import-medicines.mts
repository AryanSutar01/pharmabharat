// Imports the medicine master from a CSV into MongoDB and (re)creates the
// Atlas Search index. Safe to re-run: rows are upserted by sourceId.
//
//   node scripts/import-medicines.mts [path/to/indian_medicine_data.csv] [--limit N]
//
// Dataset (dev/demo only — see docs/SRS.md §3.3 licensing note):
//   https://github.com/junioralive/Indian-Medicine-Dataset  (DATA/indian_medicine_data.csv)
// Only factual columns are imported: name, manufacturer, composition, pack, MRP.

import { createReadStream, readFileSync } from "node:fs";
import { parse } from "csv-parse";
import { MongoClient, type AnyBulkWriteOperation, type Document } from "mongodb";
import {
  compositionKeys,
  detectForm,
  parseIngredient,
  saltKeyOf,
  collapse,
  type Ingredient,
} from "../src/lib/catalog/normalize.ts";
import { CONDITION_SEED } from "../src/lib/catalog/conditions-seed.ts";
import { PRODUCT_SEARCH_INDEX, productSearchIndexDefinition } from "../src/lib/catalog/search-index.ts";

const args = process.argv.slice(2);
const limitArg = args.indexOf("--limit");
const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : Infinity;
const file = args.find((a, i) => !a.startsWith("--") && (limitArg < 0 || i !== limitArg + 1)) ?? ".data/indian_medicine_data.csv";

function loadEnv() {
  const env: Record<string, string> = {};
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return { uri: process.env.MONGODB_URI ?? env.MONGODB_URI, db: process.env.MONGODB_DB ?? env.MONGODB_DB ?? "pharmabharat" };
}

// salt → condition slugs, from our own seed table
const conditionsBySalt = new Map<string, string[]>();
for (const c of CONDITION_SEED) {
  for (const s of c.salts) conditionsBySalt.set(s, [...(conditionsBySalt.get(s) ?? []), c.slug]);
}

// GST 2.0 (22 Sep 2025): most medicines are 5%. Sellers override per listing.
const DEFAULT_GST = 5;
const DEFAULT_HSN = "3004";

type Row = Record<string, string>;

function toProduct(r: Row) {
  if (String(r.Is_discontinued).toUpperCase() === "TRUE") return null;
  const mrp = Number(r["price(₹)"] ?? r.price);
  const name = collapse(r.name ?? "");
  if (!name || !(mrp > 0)) return null;

  const ingredients = [r.short_composition1, r.short_composition2]
    .map((s) => parseIngredient(s ?? ""))
    .filter((i): i is Ingredient => i !== null);
  const salts = [...new Set(ingredients.map((i) => saltKeyOf(i.salt)))];
  const conditions = [...new Set(salts.flatMap((s) => conditionsBySalt.get(s) ?? []))];

  return {
    sourceId: `az:${r.id}`,
    doc: {
      name,
      manufacturer: collapse(r.manufacturer_name ?? "") || "Unknown",
      form: detectForm(name, r.pack_size_label ?? ""),
      packSizeLabel: collapse(r.pack_size_label ?? ""),
      mrp: Math.round(mrp * 100) / 100,
      ingredients,
      ...compositionKeys(ingredients),
      salts,
      conditions,
      hsn: DEFAULT_HSN,
      gstRate: DEFAULT_GST,
      schedule: "unknown",
      source: "dataset",
      active: true,
    },
  };
}

async function main() {
  const { uri, db: dbName } = loadEnv();
  if (!uri) throw new Error("MONGODB_URI missing (.env.local)");
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const products = db.collection("products");

  // Conditions (upsert; admin edits to names/salts are preserved after first seed)
  await db.collection("conditions").bulkWrite(
    CONDITION_SEED.map((c) => ({
      updateOne: {
        filter: { slug: c.slug },
        update: {
          $setOnInsert: { slug: c.slug, name: c.name, salts: c.salts, active: true, createdAt: new Date() },
          $set: { updatedAt: new Date() },
        },
        upsert: true,
      },
    })),
  );
  console.log(`conditions: ${CONDITION_SEED.length} seeded`);

  const parser = createReadStream(file).pipe(parse({ columns: true, skip_empty_lines: true, relax_quotes: true, trim: false }));
  let batch: AnyBulkWriteOperation<Document>[] = [];
  let seen = 0;
  let written = 0;
  let skipped = 0;
  const started = Date.now();

  const flush = async () => {
    if (!batch.length) return;
    const res = await products.bulkWrite(batch, { ordered: false });
    written += res.upsertedCount + res.modifiedCount;
    batch = [];
  };

  for await (const row of parser as AsyncIterable<Row>) {
    if (seen >= limit) break;
    seen++;
    const p = toProduct(row);
    if (!p) {
      skipped++;
      continue;
    }
    const now = new Date();
    batch.push({
      updateOne: {
        filter: { sourceId: p.sourceId },
        update: { $set: { ...p.doc, updatedAt: now }, $setOnInsert: { sourceId: p.sourceId, createdAt: now } },
        upsert: true,
      },
    });
    if (batch.length >= 2000) {
      await flush();
      process.stdout.write(`\r  ${seen.toLocaleString()} rows read, ${written.toLocaleString()} written…`);
    }
  }
  await flush();
  console.log(`\nproducts: ${seen.toLocaleString()} read, ${written.toLocaleString()} written, ${skipped.toLocaleString()} skipped (discontinued/invalid) in ${((Date.now() - started) / 1000).toFixed(0)}s`);

  // Regular indexes (mirror of src/lib/models/product.ts)
  await products.createIndexes([
    { key: { sourceId: 1 }, unique: true, sparse: true },
    { key: { compositionKey: 1 } },
    { key: { saltKey: 1 } },
    { key: { conditions: 1 } },
    { key: { name: 1 }, collation: { locale: "en", strength: 2 } },
  ]);

  // Atlas Search index
  const existing = await products.listSearchIndexes(PRODUCT_SEARCH_INDEX).toArray();
  if (existing.length) {
    await products.updateSearchIndex(PRODUCT_SEARCH_INDEX, productSearchIndexDefinition);
    console.log(`search index "${PRODUCT_SEARCH_INDEX}": update requested`);
  } else {
    await products.createSearchIndex({ name: PRODUCT_SEARCH_INDEX, definition: productSearchIndexDefinition });
    console.log(`search index "${PRODUCT_SEARCH_INDEX}": create requested (builds in the background)`);
  }

  const stats = await db.command({ dbStats: 1 });
  console.log(`storage: data ${(stats.dataSize / 1e6).toFixed(1)} MB, indexes ${(stats.indexSize / 1e6).toFixed(1)} MB (M0 limit 512 MB)`);
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
