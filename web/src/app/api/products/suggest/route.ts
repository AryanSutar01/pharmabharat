import { NextResponse, type NextRequest } from "next/server";
import { suggestProducts } from "@/lib/catalog/queries";
import { getBusinessContext } from "@/lib/session";

/** Typeahead for the listing form: GET /api/products/suggest?q=dolo */
export async function GET(req: NextRequest) {
  const ctx = await getBusinessContext().catch(() => null);
  if (!ctx?.business || ctx.business.kyc?.status !== "approved") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const items = await suggestProducts(q);
  return NextResponse.json({ items }, { headers: { "Cache-Control": "private, max-age=30" } });
}
