import { getTranslations } from "next-intl/server";
import { SimpleHeader } from "@/components/simple-header";
import { Alert, Button, Card } from "@/components/ui";
import { connectDB } from "@/lib/db/mongo";
import { Business } from "@/lib/models/business";
import { Invitation } from "@/lib/models/membership";
import { requireUser } from "@/lib/session";
import { hashToken } from "@/lib/tokens";
import { getUsersByIds } from "@/lib/users";
import { acceptInvite } from "./actions";

export const metadata = { title: "Invitation" };

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const session = await requireUser();
  const t = await getTranslations();

  await connectDB();
  const invite = await Invitation.findOne({
    tokenHash: hashToken(token),
    status: "pending",
    expiresAt: { $gt: new Date() },
  }).lean();
  const business = invite ? await Business.findById(invite.businessId, { legalName: 1, tradeName: 1 }).lean() : null;

  let body: React.ReactNode;
  if (!invite || !business) {
    body = <Alert tone="danger">{t("invite.invalid")}</Alert>;
  } else if (invite.email !== session.user.email.toLowerCase()) {
    body = (
      <Alert tone="warning">
        {t("invite.wrongAccount", { email: invite.email, current: session.user.email })}
      </Alert>
    );
  } else {
    const inviter = (await getUsersByIds([invite.invitedBy])).get(invite.invitedBy);
    const name = business.tradeName || business.legalName;
    body = (
      <>
        <h1 className="text-xl font-semibold">{t("invite.title", { business: name })}</h1>
        <p className="mt-2 text-sm text-muted">
          {t("invite.body", { inviter: inviter?.name ?? "—", role: t(`role.${invite.role}`) })}
        </p>
        <form action={acceptInvite.bind(null, token)} className="mt-6">
          <Button type="submit" className="w-full sm:w-auto">
            {t("invite.accept")}
          </Button>
        </form>
      </>
    );
  }

  return (
    <>
      <SimpleHeader />
      <main className="mx-auto w-full max-w-lg px-4 py-10">
        <Card className="p-6">{body}</Card>
      </main>
    </>
  );
}
