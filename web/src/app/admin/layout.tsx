import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SignOutButton } from "@/components/sign-out-button";
import { Logo } from "@/components/ui";
import { connectDB } from "@/lib/db/mongo";
import { Business } from "@/lib/models/business";
import { Message } from "@/lib/models/chat";
import { requirePlatformRole } from "@/lib/session";
import { AdminTabs } from "./admin-tabs";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requirePlatformRole("admin");
  const t = await getTranslations();
  await connectDB();
  const [pendingKyc, reported] = await Promise.all([
    Business.countDocuments({ "kyc.status": "pending" }),
    Message.countDocuments({ "reports.0": { $exists: true }, hidden: false }),
  ]);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/admin/kyc">
              <Logo />
            </Link>
            <span className="rounded bg-ink px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              {t("admin.title")}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/support-desk" className="hidden text-sm text-muted hover:text-ink sm:inline">
              {t("nav.supportDesk")}
            </Link>
            <Link href="/app" className="hidden text-sm text-muted hover:text-ink sm:inline">
              {t("nav.home")}
            </Link>
            <LanguageSwitcher />
            <SignOutButton />
          </div>
        </div>
        <AdminTabs
          tabs={[
            { href: "/admin", label: t("admin.overview") },
            { href: "/admin/kyc", label: t("admin.kycQueue"), badge: pendingKyc },
            { href: "/admin/users", label: t("admin.usersTab") },
            { href: "/admin/listings", label: t("admin.listingsTab") },
            { href: "/admin/reports", label: t("admin.reportsTab"), badge: reported },
            { href: "/admin/conditions", label: t("admin.conditionsTab") },
            { href: "/admin/banners", label: t("admin.bannersTab") },
          ]}
        />
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
