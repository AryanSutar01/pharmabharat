import { getFormatter, getTranslations } from "next-intl/server";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { connectDB } from "@/lib/db/mongo";
import { Invitation, Membership } from "@/lib/models/membership";
import type { MemberRole } from "@/lib/permissions";
import { requireBusiness } from "@/lib/session";
import { getUsersByIds } from "@/lib/users";
import { InviteForm, MemberControls, RevokeButton } from "./team-controls";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const { business, session } = await requireBusiness({ permission: "team.manage" });
  const t = await getTranslations();
  const format = await getFormatter();

  await connectDB();
  const [members, invites] = await Promise.all([
    Membership.find({ businessId: business._id }).sort({ createdAt: 1 }).lean(),
    Invitation.find({ businessId: business._id, status: "pending", expiresAt: { $gt: new Date() } })
      .sort({ createdAt: -1 })
      .lean(),
  ]);
  const users = await getUsersByIds(members.map((m) => m.userId));

  return (
    <>
      <PageHeader title={t("team.title")} description={t("team.subtitle")} />
      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          <Card>
            <CardHeader title={t("team.members")} />
            <ul className="divide-y divide-line">
              {members.map((m) => {
                const u = users.get(m.userId);
                const isSelf = m.userId === session.user.id;
                return (
                  <li key={String(m._id)} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {u?.name ?? "—"} {isSelf ? <span className="text-muted">({t("common.you")})</span> : null}
                      </p>
                      <p className="truncate text-xs text-muted">{u?.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {m.status === "disabled" ? <Badge tone="danger">{t("team.disabled")}</Badge> : null}
                      {m.role === "owner" ? (
                        <Badge tone="success">{t("role.owner")}</Badge>
                      ) : (
                        <MemberControls id={String(m._id)} role={m.role as MemberRole} status={m.status as "active" | "disabled"} />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader title={t("team.pending")} />
            {invites.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted sm:px-5">{t("team.noPending")}</p>
            ) : (
              <ul className="divide-y divide-line">
                {invites.map((inv) => (
                  <li key={String(inv._id)} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{inv.email}</p>
                      <p className="text-xs text-muted">
                        {t(`role.${inv.role}`)} ·{" "}
                        {t("team.expires", { date: format.dateTime(new Date(inv.expiresAt), { dateStyle: "medium" }) })}
                      </p>
                    </div>
                    <RevokeButton id={String(inv._id)} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader title={t("team.inviteTitle")} description={t("team.inviteHelp")} />
          <div className="p-4 sm:p-5">
            <InviteForm />
          </div>
        </Card>
      </div>
    </>
  );
}
