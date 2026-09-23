import { requireShop } from "@/lib/retail/guard";
import { registerCsv, registerRows, REGISTER_SCHEDULES, type RegisterSchedule } from "@/lib/retail/register";

export const runtime = "nodejs";

/** The Schedule H/H1 register as a CSV the shop can keep or hand over. */
export async function GET(req: Request) {
  const { business } = await requireShop("retail.manage");
  const params = new URL(req.url).searchParams;

  const [y, m] = (params.get("month") ?? "").split("-").map(Number);
  const now = new Date();
  const year = Number.isInteger(y) ? y : now.getUTCFullYear();
  const month = Number.isInteger(m) ? m - 1 : now.getUTCMonth();
  const from = new Date(Date.UTC(year, month, 1));
  const to = new Date(Date.UTC(year, month + 1, 1) - 1);
  const schedule = REGISTER_SCHEDULES.find((s) => s === params.get("schedule")) as RegisterSchedule | undefined;

  const rows = await registerRows(business._id, { from, to, schedule });
  const name = `register-${from.getUTCFullYear()}-${String(from.getUTCMonth() + 1).padStart(2, "0")}.csv`;
  return new Response(registerCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  });
}
