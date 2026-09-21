"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/components/ui";

export function SignOutButton({ className }: { className?: string }) {
  const t = useTranslations("common");
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() =>
        authClient.signOut({
          fetchOptions: {
            onSuccess: () => {
              router.push("/");
              router.refresh();
            },
          },
        })
      }
      className={cn("text-sm text-muted hover:text-ink", className)}
    >
      {t("signOut")}
    </button>
  );
}
