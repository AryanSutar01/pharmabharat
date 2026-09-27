// Fills the [DEMO] retailer with a working shop: stock on the shelf, a hundred
// days of counter sales, customers with real buying patterns, supplier orders
// on credit, and the loyalty scheme running. Without this every shop screen —
// reports, refills, alerts, the register, the ledger — renders empty.
//
//   node scripts/seed-shop.mts                        # create / refresh
//   node scripts/seed-shop.mts --member you@gmail.com # also make that user its owner
//   node scripts/seed-shop.mts --remove               # delete everything it made
//
// Run `node scripts/seed-demo.mts` first: this reuses its demo distributors.
//
// Development only. Everything it writes is owned by "demo-seed" and named
// [DEMO], so --remove can find it again. Phone numbers are in a 900000xxxx
// block and emails end in .invalid, so nothing can reach a real person.

import { readFileSync } from "node:fs";
import { MongoClient, ObjectId } from "mongodb";

const DEMO_OWNER = "demo-seed";
const SHOP_NAME = "[DEMO] Shree Ganesh Medical";
const DAYS = 100; // how much trading history to write
const STAFF = { id: "demo-seed-staff", name: "Demo Counter Staff" };

/**
 * Medicines the shop keeps. These names all exist in the imported master; how
 * many tablets are in a pack is read from the catalogue's own label, the same
 * way the app does it, rather than guessed here.
 */
const SHELF: { name: string; schedule: string }[] = [
  { name: "Dolo 650 Tablet", schedule: "otc" },
  { name: "Crocin Advance Tablet", schedule: "otc" },
  { name: "Combiflam Tablet", schedule: "otc" },
  { name: "Augmentin 625 Duo Tablet", schedule: "h" },
  { name: "Azithral 500 Tablet", schedule: "h" },
  { name: "Ciplox 500 Tablet", schedule: "h" },
  { name: "PAN 40 Tablet", schedule: "h" },
  { name: "Pantop 40 Tablet", schedule: "h" },
  { name: "Glycomet 500 SR Tablet", schedule: "h" },
  { name: "Telma 40 Tablet", schedule: "h" },
  { name: "Losar 50 Tablet", schedule: "h" },
  { name: "Amlokind 5 Tablet", schedule: "h" },
  { name: "Rosuvas 10 Tablet", schedule: "h" },
  { name: "Montek LC Tablet", schedule: "h" },
  { name: "Allegra 120mg Tablet", schedule: "otc" },
  { name: "Ascoril LS Syrup", schedule: "h" },
  { name: "Benadryl Syrup", schedule: "h" },
  { name: "Thyronorm 50mcg Tablet", schedule: "h" },
  { name: "Zerodol-SP Tablet", schedule: "h" },
  { name: "Ecosprin 75 Tablet", schedule: "h" },
];

/** Medicines a long-term patient comes back for, roughly monthly. */
const CHRONIC = ["Glycomet 500 SR Tablet", "Telma 40 Tablet", "Thyronorm 50mcg Tablet", "Rosuvas 10 Tablet"];

const FIRST_NAMES = [
  "Asha", "Ravi", "Sunita", "Mahesh", "Priya", "Sachin", "Kavita", "Anil", "Meera", "Sanjay",
  "Rekha", "Vijay", "Nisha", "Prakash", "Pooja", "Dinesh", "Snehal", "Ganesh", "Manisha", "Rahul",
  "Vaishali", "Amit", "Shital", "Nitin", "Archana", "Sunil", "Pallavi", "Bhushan", "Jyoti", "Kiran",
];
const SURNAMES = [
  "Patil", "Kulkarni", "Deshmukh", "Jadhav", "Shinde", "More", "Pawar", "Joshi", "Gaikwad", "Sawant",
];
const CONDITIONS = ["diabetes", "hypertension", "thyroid", "cardiac", "asthma"];
const DOCTORS = [
  { name: "Dr A S Sharma", reg: "MMC-42119" },
  { name: "Dr R P Deshpande", reg: "MMC-38874" },
  { name: "Dr S Kulkarni", reg: "MMC-51203" },
];

const DAY_MS = 24 * 3600 * 1000;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function loadEnv() {
  const env: Record<string, string> = {};
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return { uri: env.MONGODB_URI, db: env.MONGODB_DB || "pharmabharat" };
}

/** Deterministic pseudo-random, so a re-run produces the same shop. */
let seedCounter = 0;
function rnd() {
  const x = Math.sin(++seedCounter * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}
const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
const between = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));

/** Indian financial year label for a date: 2026-09-22 → "2026-27". */
function financialYear(d: Date) {
  const y = d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
}

/**
 * Retail GST, mirroring lib/retail/gst.ts: the MRP includes the tax, so it is
 * worked backwards out of the amount actually charged, and always CGST + SGST.
 */
function taxOf(total: number, gstRate: number) {
  const taxable = round2(total / (1 + gstRate / 100));
  const gst = round2(total - taxable);
  const cgst = round2(gst / 2);
  return { taxable, cgst, sgst: round2(gst - cgst) };
}

/**
 * Tablets in a pack, read from the catalogue's free-text label — a compact
 * mirror of parsePackUnits in lib/retail/units.ts. Anything measured rather
 * than counted ("bottle of 100 ml") is one indivisible pack.
 */
function packUnits(label?: string) {
  const s = (label ?? "").toLowerCase().trim();
  if (!s) return 1;
  if (/\b\d+\s*(ml|l|gm|g|kg|mg|mcg|iu)\b/.test(s) && !/\b(tab|cap)/.test(s)) return 1;
  const m =
    /(?:strip|pack|box|bottle|jar|packet)\s*of\s*(\d+)/.exec(s) ??
    /(\d+)\s*(?:tablets?|tabs?|capsules?|caps?|sachets?)/.exec(s);
  const n = m ? Number(m[1]) : NaN;
  return Number.isInteger(n) && n > 1 && n <= 1000 ? n : 1;
}

/** Per-tablet price from a strip's MRP, rounded up — the shop's default. */
const unitPriceOf = (mrp: number, per: number) => (per <= 1 ? round2(mrp) : Math.ceil((mrp / per) * 100) / 100);

type Batch = {
  _id: ObjectId;
  productId: ObjectId;
  name: string;
  manufacturer?: string;
  packSizeLabel?: string;
  batchNo: string;
  expiryDate: Date;
  unitsPerPack: number;
  units: number; // mutated as the simulated days are billed
  /** What a replenishment delivery of this batch adds, in packs. */
  restockPacks: number;
  cost: number;
  mrp: number;
  gstRate: number;
  hsn: string;
  schedule: string;
  supplierId?: ObjectId;
  supplierName?: string;
  source: "order" | "manual";
  receivedAt: Date;
};

async function main() {
  const { uri, db: dbName } = loadEnv();
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  console.log(`database: ${dbName}`);

  const businesses = db.collection("businesses");
  const shop = await businesses.findOne({ ownerUserId: DEMO_OWNER, legalName: SHOP_NAME });

  // ---------------------------------------------------------------- remove
  if (process.argv.includes("--remove")) {
    if (!shop) {
      console.log("nothing to remove");
      await client.close();
      return;
    }
    const q = { businessId: shop._id };
    const counts: string[] = [];
    for (const name of ["shopstocks", "shopitems", "bills", "customers", "loyaltyentries", "refillnudges", "shopsettings"]) {
      const r = await db.collection(name).deleteMany(q);
      counts.push(`${r.deletedCount} ${name}`);
    }
    const orders = await db.collection("orders").deleteMany({ buyerId: shop._id });
    const credit = await db.collection("creditaccounts").deleteMany({ buyerId: shop._id });
    await db.collection("payments").deleteMany({ buyerId: shop._id });
    await db.collection("counters").deleteMany({ _id: { $regex: `^bill:${shop._id}:` } as never });
    console.log(`removed ${counts.join(", ")}, ${orders.deletedCount} orders, ${credit.deletedCount} credit accounts`);
    console.log("(the demo shop itself is left alone — remove it with seed-demo.mts --remove)");
    await client.close();
    return;
  }

  // ---------------------------------------------------------------- the shop
  const now = new Date();
  const shopDoc =
    shop ??
    (await businesses.findOneAndUpdate(
      { ownerUserId: DEMO_OWNER, legalName: SHOP_NAME },
      {
        $set: {
          type: "retailer",
          tradeName: SHOP_NAME,
          phone: "9000000001",
          email: "demo-retailer@example.invalid",
          gstin: "27AAAPZ1234C1ZV",
          address: { line1: "Sample address (demo data)", city: "Nashik", stateCode: "27", pincode: "422001" },
          drugLicenses: [{ form: "20", number: "DEMO-NSK-20", validTill: new Date("2030-12-31") }],
          pharmacist: { name: "Demo Pharmacist", registrationNumber: "DEMO-REG-1" },
          documents: [],
          kyc: { status: "approved", reviewedAt: now, reviewedBy: DEMO_OWNER, remarks: "Demo data" },
          updatedAt: now,
        },
        $setOnInsert: { legalName: SHOP_NAME, ownerUserId: DEMO_OWNER, createdAt: now },
      },
      { upsert: true, returnDocument: "after" },
    ))!;
  const shopId = shopDoc._id;

  const distributors = await businesses
    .find({ ownerUserId: DEMO_OWNER, type: "wholesaler" })
    .toArray();
  if (!distributors.length) {
    throw new Error("No demo distributors. Run `node scripts/seed-demo.mts` first.");
  }

  // ---------------------------------------------------------------- shelf
  const products = await db
    .collection("products")
    .find({ name: { $in: SHELF.map((s) => s.name) }, active: true }, { collation: { locale: "en", strength: 2 } })
    .toArray();
  // A few brands appear once per pack size; keep the first of each name.
  const byName = new Map<string, (typeof products)[number]>();
  for (const p of products) {
    const key = String(p.name).toLowerCase();
    if (!byName.has(key)) byName.set(key, p);
  }
  if (byName.size < 5) {
    throw new Error("The medicine master is empty. Run `npm run import:medicines` first.");
  }

  // Expiry is the story, so spread the batches across every bucket the app shows.
  const EXPIRY_PLAN = [-38, -9, 17, 26, 29, 44, 52, 58, 71, 83, 88];
  const shelf: Batch[] = [];
  let planIdx = 0;

  for (const [i, item] of SHELF.entries()) {
    const product = byName.get(item.name.toLowerCase());
    if (!product?.mrp) {
      console.log(`  (not in master, skipped: ${item.name})`);
      continue;
    }
    const supplier = distributors[i % distributors.length];
    const perPack = packUnits(product.packSizeLabel as string | undefined);
    // One or two batches each: older stock plus a recent top-up.
    const batches = i % 3 === 0 ? 2 : 1;
    for (let b = 0; b < batches; b++) {
      const daysToExpiry =
        planIdx < EXPIRY_PLAN.length && b === 0 ? EXPIRY_PLAN[planIdx++] : between(210, 900);
      const mrp = round2(Number(product.mrp));
      const cost = round2(mrp * (1 - (0.18 + rnd() * 0.12)));
      const packs = between(25, 70);
      // A couple of batches are mid-strip, so the shelf shows loose tablets.
      const loose = perPack > 1 && i % 5 === 0 ? between(1, perPack - 1) : 0;
      shelf.push({
        _id: new ObjectId(),
        productId: product._id,
        name: product.name,
        manufacturer: product.manufacturer,
        packSizeLabel: product.packSizeLabel,
        batchNo: `${item.name.slice(0, 3).toUpperCase()}${String(100 + i * 7 + b)}`,
        expiryDate: new Date(now.getTime() + daysToExpiry * DAY_MS),
        unitsPerPack: perPack,
        units: packs * perPack + loose,
        restockPacks: between(20, 50),
        cost,
        mrp,
        gstRate: 5,
        hsn: "3004",
        schedule: item.schedule,
        supplierId: supplier._id,
        supplierName: supplier.tradeName ?? supplier.legalName,
        source: b === 0 ? "order" : "manual",
        receivedAt: new Date(now.getTime() - between(20, 120) * DAY_MS),
      });
    }
  }

  // Two medicines that never sell, so "dead stock" has something honest in it.
  const deadNames = new Set([shelf.at(-1)!.name, shelf.at(-3)!.name]);

  // ---------------------------------------------------------------- customers
  const customerDocs: Record<string, unknown>[] = [];
  const customers: { _id: ObjectId; name: string; chronic?: string; email?: string }[] = [];
  for (let i = 0; i < 38; i++) {
    const name = `${FIRST_NAMES[i % FIRST_NAMES.length]} ${pick(SURNAMES)}`;
    const isChronic = i < 12;
    const wantsEmail = i % 3 === 0;
    const lapsed = i >= 33; // a few who stopped coming
    const _id = new ObjectId();
    const conditions = isChronic ? [CONDITIONS[i % CONDITIONS.length]] : [];
    const firstVisit = new Date(now.getTime() - between(DAYS - 10, 420) * DAY_MS);
    customers.push({
      _id,
      name,
      chronic: isChronic ? CHRONIC[i % CHRONIC.length] : undefined,
      email: wantsEmail ? `demo.customer${i}@example.invalid` : undefined,
    });
    customerDocs.push({
      _id,
      businessId: shopId,
      name,
      // Fake block: nothing here can reach a real phone.
      phone: `90000${String(10000 + i)}`,
      ...(wantsEmail ? { email: `demo.customer${i}@example.invalid` } : {}),
      ...(i % 4 === 0 ? { birthYear: between(1950, 2005) } : {}),
      conditions,
      consent: {
        given: true,
        at: firstVisit,
        version: "1",
        reminders: wantsEmail,
      },
      loyaltyPoints: 0,
      visits: 0,
      totalSpend: 0,
      firstVisitAt: firstVisit,
      ...(lapsed ? { lastVisitAt: new Date(now.getTime() - between(150, 260) * DAY_MS) } : {}),
      status: "active",
      createdBy: DEMO_OWNER,
      createdAt: firstVisit,
      updatedAt: now,
    });
  }
  const active = customers.slice(0, 33); // the lapsed ones buy nothing recent

  // ---------------------------------------------------------------- trading
  const bills: Record<string, unknown>[] = [];
  const loyaltyEntries: Record<string, unknown>[] = [];
  const stats = new Map<string, { visits: number; spend: number; points: number; last: Date }>();
  const soldUnits = new Map<string, number>(); // productId → units sold in the window
  const lastSold = new Map<string, Date>();
  let billSeq = 0;

  const sellable = () => shelf.filter((b) => b.units > 0 && b.expiryDate > now && !deadNames.has(b.name));

  /** Writes one bill for a day, taking the stock off the simulated shelf. */
  function makeBill(when: Date, customer?: (typeof customers)[number], forced?: Batch) {
    const lines: Record<string, unknown>[] = [];
    const chosen = new Set<string>();
    const count = forced ? 1 : between(1, 4);

    for (let i = 0; i < count; i++) {
      const options = sellable().filter((b) => !chosen.has(String(b._id)));
      const batch = forced ?? (options.length ? options[Math.floor(rnd() * options.length)] : undefined);
      if (!batch) continue;
      chosen.add(String(batch._id));

      // Roughly one line in five is a cut strip, where the pack allows it.
      const loose = !forced && batch.unitsPerPack > 1 && rnd() < 0.2;
      const saleUnit = loose ? "unit" : "pack";
      const qty = loose ? between(2, 10) : between(1, 3);
      const units = saleUnit === "pack" ? qty * batch.unitsPerPack : qty;
      if (units > batch.units) continue;
      batch.units -= units;

      const rate = saleUnit === "pack" ? batch.mrp : unitPriceOf(batch.mrp, batch.unitsPerPack);
      const gross = round2(rate * qty);
      const discountPercent = rnd() < 0.15 ? 5 : 0;
      const discount = round2((gross * discountPercent) / 100);
      const total = round2(gross - discount);
      const tax = taxOf(total, batch.gstRate);

      lines.push({
        stockId: batch._id,
        productId: batch.productId,
        name: batch.name,
        packSizeLabel: batch.packSizeLabel,
        batchNo: batch.batchNo,
        expiryDate: batch.expiryDate,
        hsn: batch.hsn,
        schedule: batch.schedule,
        qty,
        saleUnit,
        unitsPerPack: batch.unitsPerPack,
        units,
        rate,
        mrp: batch.mrp,
        cost: batch.cost,
        gstRate: batch.gstRate,
        discountPercent,
        gross,
        discount,
        total,
        ...tax,
      });

      soldUnits.set(String(batch.productId), (soldUnits.get(String(batch.productId)) ?? 0) + units);
      lastSold.set(String(batch.productId), when);
    }
    if (!lines.length) return;

    const sum = (k: string) => round2(lines.reduce((a, l) => a + (l[k] as number), 0));
    const total = sum("total");
    const grandTotal = Math.round(total);
    const costTotal = round2(
      lines.reduce((a, l) => a + ((l.cost as number) / (l.unitsPerPack as number)) * (l.units as number), 0),
    );
    // 1 point per ₹100, matching the settings written below.
    const earned = customer ? Math.floor(grandTotal / 100) : 0;
    const scheduled = lines.some((l) => ["h", "h1", "x"].includes(String(l.schedule)));
    const doctor = scheduled ? pick(DOCTORS) : undefined;
    const _id = new ObjectId();

    bills.push({
      _id,
      businessId: shopId,
      billNo: `${financialYear(when)}/${String(++billSeq).padStart(5, "0")}`,
      ...(customer ? { customerId: customer._id, customer: { name: customer.name } } : {}),
      lines,
      totals: {
        gross: sum("gross"),
        discount: sum("discount"),
        taxable: sum("taxable"),
        cgst: sum("cgst"),
        sgst: sum("sgst"),
        tax: round2(sum("cgst") + sum("sgst")),
        redeemed: 0,
        roundOff: round2(grandTotal - total),
        grandTotal,
      },
      costTotal,
      payment: { mode: rnd() < 0.55 ? "cash" : rnd() < 0.7 ? "upi" : "card" },
      loyalty: { earned, redeemed: 0, value: 0 },
      ...(doctor ? { prescription: { doctorName: doctor.name, registrationNo: doctor.reg } } : {}),
      status: "final",
      createdBy: STAFF.id,
      createdByName: STAFF.name,
      createdAt: when,
      updatedAt: when,
    });

    if (customer) {
      const s = stats.get(String(customer._id)) ?? { visits: 0, spend: 0, points: 0, last: when };
      s.visits += 1;
      s.spend = round2(s.spend + grandTotal);
      s.points += earned;
      s.last = when;
      stats.set(String(customer._id), s);
      if (earned) {
        loyaltyEntries.push({
          businessId: shopId,
          customerId: customer._id,
          billId: _id,
          kind: "earned",
          points: earned,
          value: 0,
          expiresAt: new Date(when.getTime() + 365 * DAY_MS),
          createdBy: STAFF.id,
          createdAt: when,
          updatedAt: when,
        });
      }
    }
  }

  // Walk the days oldest first so bill numbers run in order.
  for (let d = DAYS; d >= 0; d--) {
    const day = new Date(now.getTime() - d * DAY_MS);

    // A real shop replenishes. Every couple of weeks anything that has run
    // down gets topped up, the way a delivery would — without this the shelf
    // empties halfway through the window and the counter stops selling.
    if (d % 13 === 0) {
      for (const b of shelf) {
        if (b.expiryDate <= day || deadNames.has(b.name)) continue;
        if (b.units < b.restockPacks * b.unitsPerPack * 0.4) b.units += b.restockPacks * b.unitsPerPack;
      }
    }
    const sunday = day.getUTCDay() === 0;
    const perDay = sunday ? between(2, 5) : between(5, 12);
    for (let i = 0; i < perDay; i++) {
      const at = new Date(day);
      at.setUTCHours(between(9, 20), between(0, 59), between(0, 59), 0);
      // Roughly two in five sales are attached to a known customer.
      makeBill(at, rnd() < 0.4 ? active[Math.floor(rnd() * active.length)] : undefined);
    }
  }

  // Long-term patients: the same medicine about every 28 days, the last one just
  // overdue, which is what puts them on the refill list today.
  for (const customer of customers.filter((c) => c.chronic)) {
    const batch = shelf.find((b) => b.name === customer.chronic && b.units > 0);
    if (!batch) continue;
    const gap = between(28, 31);
    for (const n of [3, 2, 1]) {
      const at = new Date(now.getTime() - (n * gap - between(0, 2)) * DAY_MS);
      at.setUTCHours(between(10, 19), between(0, 59), 0, 0);
      makeBill(at, customer, batch);
    }
  }
  bills.sort((a, b) => (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime());
  bills.forEach((b, i) => {
    b.billNo = `${financialYear(b.createdAt as Date)}/${String(i + 1).padStart(5, "0")}`;
  });

  // One medicine that regulars are due for, deliberately out of stock, so the
  // refill page shows the "not on your shelf" case — and the restock flow has
  // something real to fix. Every batch of it, not just one, or the product
  // still has stock somewhere.
  const outOfStock = shelf.filter((b) => b.name === CHRONIC[1]);
  for (const b of outOfStock) b.units = 0;

  // ---------------------------------------------------------------- supplier orders
  const orders: Record<string, unknown>[] = [];
  const party = (b: Record<string, unknown>) => ({
    name: (b.tradeName as string) || (b.legalName as string),
    gstin: b.gstin,
    phone: b.phone,
    email: b.email,
    address: "Sample address (demo data)",
    stateCode: (b.address as { stateCode?: string })?.stateCode ?? "27",
    drugLicenses: "",
  });

  for (let i = 0; i < 9; i++) {
    const seller = distributors[i % distributors.length];
    const when = new Date(now.getTime() - between(5, 80) * DAY_MS);
    const items = shelf.slice(i * 2, i * 2 + 3).map((b) => {
      const qty = between(10, 40);
      const taxable = round2(b.cost * qty);
      const gst = round2((taxable * b.gstRate) / 100);
      const cgst = round2(gst / 2);
      return {
        listingId: new ObjectId(),
        productId: b.productId,
        name: b.name,
        manufacturer: b.manufacturer,
        packSizeLabel: b.packSizeLabel,
        batchNo: b.batchNo,
        expiryDate: b.expiryDate,
        hsn: b.hsn,
        qty,
        mrp: b.mrp,
        price: b.cost,
        gstRate: b.gstRate,
        taxable,
        cgst,
        sgst: round2(gst - cgst),
        igst: 0,
        total: round2(taxable + gst),
      };
    });
    if (!items.length) continue;
    const taxable = round2(items.reduce((a, l) => a + l.taxable, 0));
    const cgst = round2(items.reduce((a, l) => a + l.cgst, 0));
    const sgst = round2(items.reduce((a, l) => a + l.sgst, 0));
    const exact = round2(taxable + cgst + sgst);
    const grandTotal = Math.round(exact);
    // The newest three are still unpaid, so the ledger shows something to settle.
    const unpaid = i < 3;
    const month = `${String(when.getUTCFullYear()).slice(2)}${String(when.getUTCMonth() + 1).padStart(2, "0")}`;

    orders.push({
      orderNo: `PB-${month}-${String(900 + i).padStart(6, "0")}`,
      groupId: new ObjectId().toHexString(),
      buyerId: shopId,
      sellerId: seller._id,
      placedBy: DEMO_OWNER,
      buyer: party(shopDoc),
      seller: party(seller),
      interState: false,
      items,
      totals: { taxable, cgst, sgst, igst: 0, tax: round2(cgst + sgst), roundOff: round2(grandTotal - exact), grandTotal },
      status: unpaid ? "delivered" : "delivered",
      history: [{ status: "delivered", at: when, by: DEMO_OWNER }],
      invoice: { number: `INV/${financialYear(when)}/${String(500 + i).padStart(6, "0")}`, date: when },
      payment: {
        mode: "credit",
        status: unpaid ? "unpaid" : "paid",
        paidAmount: unpaid ? 0 : grandTotal,
        ...(unpaid ? {} : { paidAt: when }),
        creditDays: 21,
        // Two of the three unpaid ones are already overdue.
        dueAt: new Date(when.getTime() + 21 * DAY_MS),
      },
      createdAt: when,
      updatedAt: when,
    });
  }

  // ---------------------------------------------------------------- write
  const wipe = { businessId: shopId };
  await Promise.all([
    db.collection("shopstocks").deleteMany(wipe),
    db.collection("shopitems").deleteMany(wipe),
    db.collection("bills").deleteMany(wipe),
    db.collection("customers").deleteMany(wipe),
    db.collection("loyaltyentries").deleteMany(wipe),
    db.collection("refillnudges").deleteMany(wipe),
    db.collection("orders").deleteMany({ buyerId: shopId }),
    db.collection("creditaccounts").deleteMany({ buyerId: shopId }),
  ]);

  await db.collection("shopstocks").insertMany(
    shelf.map((b) => ({
      _id: b._id,
      businessId: shopId,
      productId: b.productId,
      name: b.name,
      manufacturer: b.manufacturer,
      packSizeLabel: b.packSizeLabel,
      batchNo: b.batchNo,
      expiryDate: b.expiryDate,
      units: b.units,
      unitsPerPack: b.unitsPerPack,
      cost: b.cost,
      mrp: b.mrp,
      gstRate: b.gstRate,
      hsn: b.hsn,
      schedule: b.schedule,
      expiryAlertLevel: null,
      source: b.source,
      supplierId: b.supplierId,
      supplierName: b.supplierName,
      receivedAt: b.receivedAt,
      addedBy: DEMO_OWNER,
      createdAt: b.receivedAt,
      updatedAt: now,
    })),
  );

  // Per-product settings, with the sales speed the nightly job would have found:
  // packs sold over a 90-day window, covering 15 days.
  const productIds = [...new Set(shelf.map((b) => String(b.productId)))];
  await db.collection("shopitems").insertMany(
    productIds.map((pid) => {
      const batch = shelf.find((b) => String(b.productId) === pid)!;
      const packs = (soldUnits.get(pid) ?? 0) / batch.unitsPerPack;
      const dailySales = round2(packs / 90);
      return {
        businessId: shopId,
        productId: batch.productId,
        name: batch.name,
        dailySales,
        reorderLevel: Math.ceil(dailySales * 15),
        manualReorderLevel: false,
        ...(lastSold.get(pid) ? { lastSoldAt: lastSold.get(pid) } : {}),
        computedAt: now,
        createdAt: now,
        updatedAt: now,
      };
    }),
  );

  for (const c of customerDocs) {
    const s = stats.get(String(c._id));
    if (s) Object.assign(c, { visits: s.visits, totalSpend: s.spend, loyaltyPoints: s.points, lastVisitAt: s.last });
  }
  await db.collection("customers").insertMany(customerDocs);
  if (bills.length) await db.collection("bills").insertMany(bills);
  if (loyaltyEntries.length) await db.collection("loyaltyentries").insertMany(loyaltyEntries);
  if (orders.length) await db.collection("orders").insertMany(orders);

  // Credit terms per distributor, so the ledger and supplier pages have them.
  await db.collection("creditaccounts").insertMany(
    distributors.map((s) => ({
      sellerId: s._id,
      buyerId: shopId,
      creditLimit: 100000,
      creditDays: 21,
      note: "Demo terms",
      updatedBy: DEMO_OWNER,
      createdAt: now,
      updatedAt: now,
    })),
  );

  await db.collection("shopsettings").updateOne(
    { businessId: shopId },
    {
      $set: {
        reorderCoverDays: 15,
        retentionMonths: 36,
        looseRounding: "up",
        loyalty: { active: true, pointsPerHundred: 1, pointValue: 1, minRedeemPoints: 50, expiryMonths: 12 },
        updatedBy: DEMO_OWNER,
        updatedAt: now,
      },
      $setOnInsert: { businessId: shopId, createdAt: now },
    },
    { upsert: true },
  );

  // The counter must continue from the seeded bills, or the first real sale
  // collides with bill number 1 on the unique (business, billNo) index.
  const lastFy = financialYear(now);
  const inFy = bills.filter((b) => financialYear(b.createdAt as Date) === lastFy).length;
  await db
    .collection("counters")
    .updateOne({ _id: `bill:${shopId}:${lastFy}` as never }, { $set: { seq: inFy } }, { upsert: true });

  // ---------------------------------------------------------------- membership
  const memberIdx = process.argv.indexOf("--member");
  if (memberIdx > 0) {
    const email = (process.argv[memberIdx + 1] ?? "").toLowerCase();
    const user = await db.collection("user").findOne({ email });
    if (!user) throw new Error(`No signed-up user with email ${email} — sign in once first.`);
    await db.collection("memberships").updateOne(
      { businessId: shopId, userId: String(user._id) },
      { $set: { role: "owner", status: "active", updatedAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true },
    );
    console.log(`${email} is now owner of "${SHOP_NAME}"`);
  }

  const expiring = shelf.filter((b) => b.expiryDate > now && b.expiryDate.getTime() - now.getTime() < 90 * DAY_MS);
  const expired = shelf.filter((b) => b.expiryDate <= now);
  console.log(
    [
      "",
      `shop:       ${SHOP_NAME}`,
      `shelf:      ${shelf.length} batches (${expiring.length} expiring within 90 days, ${expired.length} already expired)`,
      `bills:      ${bills.length} over ${DAYS} days`,
      `customers:  ${customerDocs.length} (${customers.filter((c) => c.chronic).length} on long-term medicines)`,
      `orders:     ${orders.length} supplier orders, 3 unpaid`,
      `loyalty:    on, ${loyaltyEntries.length} point entries`,
      "",
      "remove it all with: node scripts/seed-shop.mts --remove",
    ].join("\n"),
  );
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
