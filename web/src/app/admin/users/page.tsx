import { getFormatter, getTranslations } from "next-intl/server";
import { Badge, Button, Card, Input, PageHeader } from "@/components/ui";
import { mongoDb } from "@/lib/db/mongo";
import { requirePlatformRole } from "@/lib/session";
import { UserControls } from "./user-controls";

export const metadata = { title: "Users" };

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  const session = await requirePlatformRole("admin");
  const t = await getTranslations();
  const format = await getFormatter();
  const q = typeof (await searchParams).q === "string" ? ((await searchParams).q as string).trim().slice(0, 80) : "";

  const filter = q ? { $or: [{ email: { $regex: escapeRegex(q), $options: "i" } }, { name: { $regex: escapeRegex(q), $options: "i" } }] } : {};
  const users = await mongoDb()
    .collection("user")
    .find(filter, { projection: { name: 1, email: 1, platformRole: 1, banned: 1, createdAt: 1 } })
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();

  return (
    <>
      <PageHeader title={t("admin.usersTab")} />
      <form className="mb-4 flex gap-2">
        <Input name="q" type="search" defaultValue={q} placeholder={t("admin.searchUsers")} className="max-w-sm" />
        <Button type="submit" variant="secondary">
          {t("admin.search")}
        </Button>
      </form>
      <Card>
        <ul className="divide-y divide-line">
          {users.map((u) => {
            const id = String(u._id);
            return (
              <li key={id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {u.name} {u.banned ? <Badge tone="danger">{t("admin.banned")}</Badge> : null}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {u.email} · {t("admin.joined", { date: format.dateTime(new Date(u.createdAt), { dateStyle: "medium" }) })}
                  </p>
                </div>
                {id === session.user.id ? (
                  <Badge tone="success">{t(`admin.platformRole.${u.platformRole ?? "user"}`)} · {t("common.you")}</Badge>
                ) : (
                  <UserControls id={id} role={u.platformRole ?? "user"} banned={Boolean(u.banned)} />
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
