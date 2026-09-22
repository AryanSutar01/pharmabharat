import { getFormatter, getTranslations } from "next-intl/server";
import { Button, Card, PageHeader } from "@/components/ui";
import { communityTitle } from "@/lib/chat/service";
import { connectDB } from "@/lib/db/mongo";
import { Conversation, Message } from "@/lib/models/chat";
import { requirePlatformRole } from "@/lib/session";
import { moderateMessage } from "../actions";

export const metadata = { title: "Reported messages" };

export default async function ReportsPage() {
  await requirePlatformRole("admin");
  const t = await getTranslations();
  const format = await getFormatter();
  await connectDB();
  const messages = await Message.find({ "reports.0": { $exists: true }, hidden: false }).sort({ createdAt: -1 }).limit(100).lean();
  const convs = await Conversation.find({ _id: { $in: messages.map((m) => m.conversationId) } }, { type: 1, slug: 1 }).lean();
  const where = new Map(convs.map((c) => [String(c._id), c.type === "community" ? `# ${communityTitle(c.slug ?? "")}` : t("chat.direct")]));

  return (
    <>
      <PageHeader title={t("admin.reportsTab")} />
      <Card>
        {messages.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted">{t("admin.noReports")}</p>
        ) : (
          <ul className="divide-y divide-line">
            {messages.map((m) => (
              <li key={String(m._id)} className="space-y-2 px-4 py-4 sm:px-5">
                <p className="text-xs text-muted">
                  {where.get(String(m.conversationId))} · {m.senderBusinessName} ({m.senderUserName}) ·{" "}
                  {format.dateTime(new Date(m.createdAt), { dateStyle: "medium", timeStyle: "short" })}
                </p>
                <p className="whitespace-pre-wrap rounded-lg bg-canvas px-3 py-2 text-sm">{m.text || "📷"}</p>
                <ul className="space-y-0.5 text-xs text-red-700">
                  <li className="font-medium">{t("admin.reportedBy", { count: m.reports.length })}</li>
                  {m.reports.slice(0, 5).map((r, i) => (
                    <li key={i}>“{r.reason}”</li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <form action={moderateMessage.bind(null, String(m._id), "hide")}>
                    <Button type="submit" variant="danger" className="h-9 px-3">
                      {t("admin.hide")}
                    </Button>
                  </form>
                  <form action={moderateMessage.bind(null, String(m._id), "dismiss")}>
                    <Button type="submit" variant="secondary" className="h-9 px-3">
                      {t("admin.dismiss")}
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
