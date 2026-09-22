import { NextResponse } from "next/server";
import { allowedRooms } from "@/lib/chat/service";
import { env } from "@/lib/env";
import { can } from "@/lib/permissions";
import { realtimeConfigured, rooms, signRealtimeToken } from "@/lib/realtime";
import { getBusinessContext, getSession } from "@/lib/session";

/**
 * Issues a 10-minute token for the realtime service, scoped to the rooms this
 * user may hear: their active business's rooms, plus the support room for agents.
 */
export async function GET() {
  if (!realtimeConfigured()) return NextResponse.json({ enabled: false });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const granted: string[] = [];
  if (["support", "admin"].includes(session.user.platformRole as string)) granted.push(rooms.support);
  const ctx = await getBusinessContext().catch(() => null);
  if (ctx?.business && ctx.role && ctx.business.kyc?.status === "approved" && can(ctx.role, "chat.use")) {
    granted.push(...allowedRooms(ctx.business));
  }
  if (!granted.length) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  return NextResponse.json(
    { enabled: true, url: env().REALTIME_URL, token: signRealtimeToken(granted) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
