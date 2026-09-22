import { NextResponse } from "next/server";
import { allowedRooms } from "@/lib/chat/service";
import { env } from "@/lib/env";
import { can } from "@/lib/permissions";
import { realtimeConfigured, signRealtimeToken } from "@/lib/realtime";
import { getBusinessContext } from "@/lib/session";

/** Issues a 10-minute token for the realtime service, scoped to this business's rooms. */
export async function GET() {
  if (!realtimeConfigured()) return NextResponse.json({ enabled: false });
  const ctx = await getBusinessContext().catch(() => null);
  if (!ctx?.business || !ctx.role || ctx.business.kyc?.status !== "approved" || !can(ctx.role, "chat.use")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(
    { enabled: true, url: env().REALTIME_URL, token: signRealtimeToken(allowedRooms(ctx.business)) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
