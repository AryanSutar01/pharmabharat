import "server-only";
import mongoose from "mongoose";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db/mongo";
import { Business, type BusinessDoc } from "@/lib/models/business";
import { Cart } from "@/lib/models/cart";
import { Listing, type ListingDoc } from "@/lib/models/listing";
import { Product, type ProductDoc } from "@/lib/models/product";
import { isInterState } from "@/lib/india";
import { computeTotals, lineTax, type Totals } from "@/lib/orders/gst";
import { requireBusiness } from "@/lib/session";

/** Business types that can buy. Pharma companies sell through distributors, not buy. */
const BUYER_TYPES = ["retailer", "wholesaler"];

export async function requireBuyer() {
  const ctx = await requireBusiness({ permission: "orders.place" });
  if (!BUYER_TYPES.includes(ctx.business.type)) redirect("/403");
  if (!ctx.business.address?.stateCode) redirect("/app/business");
  return ctx;
}

export type LineIssue = "unavailable" | "below_moq" | "insufficient_stock";

export type CartLine = {
  listingId: string;
  productId: string;
  name: string;
  packSizeLabel: string;
  batchNo: string;
  expiryDate: string;
  mrp: number;
  price: number;
  gstRate: number;
  hsn: string;
  qty: number;
  minOrderQty: number;
  stock: number;
  lineTotal: number;
  issue: LineIssue | null;
};

export type CartGroup = {
  sellerId: string;
  sellerName: string;
  sellerCity: string;
  sellerStateCode: string;
  interState: boolean;
  lines: CartLine[];
  totals: Totals;
};

const MIN_SHELF_LIFE_MS = 30 * 24 * 3600 * 1000;

export async function cartCount(businessId: mongoose.Types.ObjectId, userId: string) {
  await connectDB();
  const cart = await Cart.findOne({ businessId, userId }, { items: 1 }).lean();
  return cart?.items.length ?? 0;
}

/**
 * The buyer's cart, re-validated against live listings and grouped by seller.
 * Totals are a preview — placeOrder recomputes everything server-side.
 */
export async function getCartView(buyer: BusinessDoc, userId: string) {
  await connectDB();
  const cart = await Cart.findOne({ businessId: buyer._id, userId }).lean();
  const items = cart?.items ?? [];
  if (!items.length) return { groups: [] as CartGroup[], count: 0, hasIssues: false };

  const listings = await Listing.find({ _id: { $in: items.map((i) => i.listingId) } }).lean();
  const listingById = new Map(listings.map((l) => [String(l._id), l]));
  const [products, sellers] = await Promise.all([
    Product.find({ _id: { $in: listings.map((l) => l.productId) } }, { name: 1, packSizeLabel: 1 }).lean(),
    Business.find({ _id: { $in: listings.map((l) => l.sellerId) } }, { legalName: 1, tradeName: 1, address: 1, kyc: 1 }).lean(),
  ]);
  const productById = new Map(products.map((p) => [String(p._id), p]));
  const sellerById = new Map(sellers.map((s) => [String(s._id), s]));
  const buyerState = buyer.address!.stateCode;

  const groups = new Map<string, CartGroup>();
  for (const item of items) {
    const l = listingById.get(String(item.listingId));
    if (!l) continue; // listing deleted — silently dropped from the view
    const s = sellerById.get(String(l.sellerId));
    const p = productById.get(String(l.productId));
    if (!s || !p) continue;

    const line = toLine(item.qty, l, p, isAvailable(l, s));
    let g = groups.get(String(s._id));
    if (!g) {
      const sellerState = s.address?.stateCode ?? buyerState;
      g = {
        sellerId: String(s._id),
        sellerName: s.tradeName || s.legalName,
        sellerCity: s.address?.city ?? "",
        sellerStateCode: sellerState,
        interState: isInterState(sellerState, buyerState),
        lines: [],
        totals: computeTotals([]),
      };
      groups.set(g.sellerId, g);
    }
    g.lines.push(line);
  }

  for (const g of groups.values()) {
    const valid = g.lines.filter((l) => !l.issue);
    g.totals = computeTotals(valid.map((l) => lineTax(l, g.interState)));
  }
  const list = [...groups.values()];
  return { groups: list, count: items.length, hasIssues: list.some((g) => g.lines.some((l) => l.issue)) };
}

function isAvailable(l: ListingDoc, seller: Pick<BusinessDoc, "kyc">) {
  return (
    l.status === "active" &&
    seller.kyc?.status === "approved" &&
    new Date(l.expiryDate).getTime() > Date.now() + MIN_SHELF_LIFE_MS
  );
}

function toLine(qty: number, l: ListingDoc & { _id: mongoose.Types.ObjectId }, p: Pick<ProductDoc, "name" | "packSizeLabel">, available: boolean): CartLine {
  const moq = l.minOrderQty ?? 1;
  const issue: LineIssue | null = !available
    ? "unavailable"
    : qty > l.stock
      ? "insufficient_stock"
      : qty < moq
        ? "below_moq"
        : null;
  return {
    listingId: String(l._id),
    productId: String(l.productId),
    name: p.name,
    packSizeLabel: p.packSizeLabel ?? "",
    batchNo: l.batchNo,
    expiryDate: new Date(l.expiryDate).toISOString(),
    mrp: l.mrp,
    price: l.price,
    gstRate: l.gstRate,
    hsn: l.hsn,
    qty,
    minOrderQty: moq,
    stock: l.stock,
    lineTotal: Math.round(l.price * qty * 100) / 100,
    issue,
  };
}
