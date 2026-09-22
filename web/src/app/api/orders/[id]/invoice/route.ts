import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongo";
import { Membership } from "@/lib/models/membership";
import { Order } from "@/lib/models/order";
import { renderInvoicePdf } from "@/lib/orders/invoice-pdf";
import { hasInvoice, type OrderStatus } from "@/lib/orders/status";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

/**
 * GST invoice PDF, generated on demand (nothing is stored).
 * Visible to active members of the buyer or seller business, and to admins.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/orders/[id]/invoice">) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL(`/sign-in?next=/api/orders/${id}/invoice`, _req.url));
  if (!isValidObjectId(id)) return new NextResponse("Not found", { status: 404 });

  await connectDB();
  const order = await Order.findById(id).lean();
  if (!order) return new NextResponse("Not found", { status: 404 });

  if (session.user.platformRole !== "admin") {
    const member = await Membership.exists({
      userId: session.user.id,
      status: "active",
      businessId: { $in: [order.buyerId, order.sellerId] },
    });
    if (!member) return new NextResponse("Forbidden", { status: 403 });
  }
  if (!hasInvoice(order.status as OrderStatus) || !order.invoice?.number) {
    return new NextResponse("Invoice not available yet", { status: 409 });
  }

  const pdf = await renderInvoicePdf(order);
  const filename = `${order.invoice.number.replace(/\//g, "-")}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
