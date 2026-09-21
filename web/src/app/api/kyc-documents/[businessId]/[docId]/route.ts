import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongo";
import { Business } from "@/lib/models/business";
import { Membership } from "@/lib/models/membership";
import { getSession } from "@/lib/session";
import { kycDownloadUrl } from "@/lib/cloudinary";

/**
 * Redirects to a 10-minute signed Cloudinary link for a KYC document.
 * Only platform admins/support and members of the owning business may view.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/kyc-documents/[businessId]/[docId]">) {
  const { businessId, docId } = await ctx.params;
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (!isValidObjectId(businessId) || !isValidObjectId(docId)) return new NextResponse("Not found", { status: 404 });

  await connectDB();
  const staff = ["admin", "support"].includes(session.user.platformRole as string);
  if (!staff) {
    const member = await Membership.exists({ businessId, userId: session.user.id, status: "active" });
    if (!member) return new NextResponse("Forbidden", { status: 403 });
  }

  const business = await Business.findById(businessId, { documents: 1 }).lean();
  const doc = business?.documents.find((d) => String(d._id) === docId);
  if (!doc) return new NextResponse("Not found", { status: 404 });

  const res = NextResponse.redirect(kycDownloadUrl(doc.publicId, doc.format ?? "pdf"));
  res.headers.set("Cache-Control", "no-store");
  return res;
}
