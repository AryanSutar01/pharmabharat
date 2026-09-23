import { getFormatter, getTranslations } from "next-intl/server";
import { Alert, Badge, Card, CardHeader, PageHeader, buttonClass } from "@/components/ui";
import { requireShop } from "@/lib/retail/guard";
import { registerRows, REGISTER_SCHEDULES, type RegisterSchedule } from "@/lib/retail/register";

export const metadata = { title: "Schedule H register" };

/** Defaults to the current month, which is how a shop reviews its register. */
function monthRange(value?: string) {
  const now = new Date();
  const [y, m] = (value ?? "").split("-").map(Number);
  const year = Number.isInteger(y) ? y : now.getUTCFullYear();
  const month = Number.isInteger(m) ? m - 1 : now.getUTCMonth();
  const from = new Date(Date.UTC(year, month, 1));
  const to = new Date(Date.UTC(year, month + 1, 1) - 1);
  return { from, to, value: `${from.getUTCFullYear()}-${String(from.getUTCMonth() + 1).padStart(2, "0")}` };
}

export default async function RegisterPage({ searchParams }: PageProps<"/app/shop/register">) {
  const { business } = await requireShop("retail.manage");
  const t = await getTranslations("shop");
  const format = await getFormatter();
  const sp = await searchParams;

  const { from, to, value } = monthRange(typeof sp.month === "string" ? sp.month : undefined);
  const schedule = REGISTER_SCHEDULES.find((s) => s === sp.schedule) as RegisterSchedule | undefined;
  const rows = await registerRows(business._id, { from, to, schedule });
  const incomplete = rows.filter((r) => r.incomplete).length;

  const dateTime = (d: string) => format.dateTime(new Date(d), { dateStyle: "medium", timeStyle: "short" });
  const query = new URLSearchParams({ month: value, ...(schedule ? { schedule } : {}) }).toString();

  return (
    <>
      <PageHeader
        title={t("registerTitle")}
        description={t("registerSubtitle")}
        action={
          rows.length ? (
            <a href={`/api/shop/register?${query}`} className={buttonClass("secondary")}>
              ↓ {t("exportCsv")}
            </a>
          ) : null
        }
      />

      <Card className="mb-5">
        <form className="flex flex-wrap items-end gap-3 p-4 sm:p-5" action="/app/shop/register">
          <label className="text-sm">
            <span className="mb-1 block font-medium">{t("month")}</span>
            <input
              type="month"
              name="month"
              defaultValue={value}
              className="h-10 rounded-lg border border-line bg-white px-3 text-base sm:text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">{t("schedule")}</span>
            <select
              name="schedule"
              defaultValue={schedule ?? ""}
              className="h-10 rounded-lg border border-line bg-white px-3 text-base sm:text-sm"
            >
              <option value="">{t("allSchedules")}</option>
              {REGISTER_SCHEDULES.map((s) => (
                <option key={s} value={s}>
                  {s.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={buttonClass("primary", "h-10")}>
            {t("show")}
          </button>
        </form>
      </Card>

      {incomplete ? (
        <div className="mb-5">
          <Alert tone="warning" title={t("registerIncomplete", { count: incomplete })}>
            {t("registerIncompleteHint")}
          </Alert>
        </div>
      ) : null}

      <Card className="overflow-x-auto">
        <CardHeader title={t("registerEntries", { count: rows.length })} description={t("registerHint")} />
        {rows.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted">{t("registerEmpty")}</p>
        ) : (
          <table className="w-full min-w-[56rem] text-sm">
            <thead>
              <tr className="border-y border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-2 sm:px-5">{t("date")}</th>
                <th className="px-2 py-2">{t("billNoShort")}</th>
                <th className="px-2 py-2">{t("medicine")}</th>
                <th className="px-2 py-2">{t("batch")}</th>
                <th className="px-2 py-2 text-right">{t("qty")}</th>
                <th className="px-2 py-2">{t("patient")}</th>
                <th className="px-4 py-2 sm:px-5">{t("prescriber")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.billId}-${i}`} className="border-b border-line/60 align-top">
                  <td className="px-4 py-2 sm:px-5">{dateTime(r.date)}</td>
                  <td className="px-2 py-2">{r.billNo}</td>
                  <td className="px-2 py-2">
                    {r.medicine}
                    <Badge tone="neutral">{r.schedule}</Badge>
                  </td>
                  <td className="px-2 py-2">
                    {r.batchNo}
                    <span className="block text-xs text-muted">
                      {format.dateTime(new Date(r.expiryDate), { month: "2-digit", year: "2-digit" })}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.qty}</td>
                  <td className="px-2 py-2">
                    {r.patientName || "—"}
                    {r.patientPhone ? <span className="block text-xs text-muted">{r.patientPhone}</span> : null}
                  </td>
                  <td className="px-4 py-2 sm:px-5">
                    {r.doctorName ? (
                      <>
                        {r.doctorName}
                        <span className="block text-xs text-muted">{r.registrationNo || "—"}</span>
                      </>
                    ) : (
                      <span className="text-red-600">{t("prescriberMissing")}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
