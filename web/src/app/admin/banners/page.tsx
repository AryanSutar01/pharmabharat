import { getFormatter, getTranslations } from "next-intl/server";
import { Badge, Button, Card, CardHeader, PageHeader } from "@/components/ui";
import { connectDB } from "@/lib/db/mongo";
import { Banner } from "@/lib/models/banner";
import { requirePlatformRole } from "@/lib/session";
import { deleteBanner, setBannerActive } from "../actions";
import { BannerForm } from "./banner-form";

export const metadata = { title: "Banners" };

export default async function BannersPage() {
  await requirePlatformRole("admin");
  const t = await getTranslations("admin");
  const format = await getFormatter();
  await connectDB();
  const banners = await Banner.find().sort({ createdAt: -1 }).limit(50).lean();
  const d = (x?: Date | null) => (x ? format.dateTime(new Date(x), { dateStyle: "medium" }) : "—");

  return (
    <>
      <PageHeader title={t("bannersTab")} />
      <div className="space-y-5">
        <Card>
          <CardHeader title={t("newBanner")} />
          <div className="p-4 sm:p-5">
            <BannerForm />
          </div>
        </Card>
        <Card>
          {banners.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted">{t("noBanners")}</p>
          ) : (
            <ul className="divide-y divide-line">
              {banners.map((b) => (
                <li key={String(b._id)} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div className="min-w-0">
                    <p className="font-medium">{b.title?.en}</p>
                    <p className="truncate text-xs text-muted">{b.body?.en}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge tone={b.active ? "success" : "neutral"}>{b.active ? t("active") : t("inactive")}</Badge>
                      <Badge>{t(`audienceLabel.${b.audience ?? "all"}`)}</Badge>
                      <Badge tone={(b.tone ?? "info") as "info" | "success" | "warning"}>{t(`toneLabel.${b.tone ?? "info"}`)}</Badge>
                      <span className="text-xs text-muted">
                        {d(b.startsAt)} → {d(b.endsAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <form action={setBannerActive.bind(null, String(b._id), !b.active)}>
                      <Button type="submit" variant="secondary" className="h-9 px-3">
                        {b.active ? t("deactivate") : t("activate")}
                      </Button>
                    </form>
                    <form action={deleteBanner.bind(null, String(b._id))}>
                      <Button type="submit" variant="ghost" className="h-9 px-3 text-red-600">
                        {t("delete")}
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
