import "server-only";
import { connectDB } from "@/lib/db/mongo";
import { sendMail } from "@/lib/mail";
import { licenceEmail } from "@/lib/mail/templates";
import { Business, type BusinessDoc } from "@/lib/models/business";
import { notify } from "@/lib/notifications";
import { getUsersByIds } from "@/lib/users";
import { dueLicenceWarning, licenceStatus, LICENCE_WARN_LEVELS } from "./rules";

const DAY = 24 * 3600 * 1000;

/** Everyone whose earliest licence is inside the warning window or already gone. */
function affectedFilter(now: Date) {
  return {
    "kyc.status": "approved" as const,
    "drugLicenses.validTill": { $lte: new Date(now.getTime() + LICENCE_WARN_LEVELS[0] * DAY) },
  };
}

async function tell(business: BusinessDoc, kind: "licence_expiring", params: { form: string; days: number }, mail: ReturnType<typeof licenceEmail>) {
  await notify({
    businessId: business._id,
    permission: "business.edit",
    kind,
    params,
    link: "/app/business",
  });
  const owner = (await getUsersByIds([business.ownerUserId])).get(business.ownerUserId);
  for (const to of new Set([business.email, owner?.email].filter((e): e is string => Boolean(e)))) {
    await sendMail({ to, ...mail });
  }
}

/**
 * Daily job. Warns a business 60 / 30 / 7 days before its drug licence runs
 * out, and suspends it the day after: a suspended business can't sell or buy
 * until an admin re-approves the renewed licence.
 */
export async function runLicenceChecks(now = new Date()) {
  await connectDB();
  const businesses = await Business.find(affectedFilter(now)).limit(1000).lean();
  let warned = 0;
  let suspended = 0;

  for (const b of businesses) {
    const { status, daysLeft, licence } = licenceStatus(b.drugLicenses, now);
    if (!licence) continue;

    if (status === "expired") {
      await Business.updateOne(
        { _id: b._id, "kyc.status": "approved" },
        {
          $set: {
            "kyc.status": "suspended",
            "kyc.remarks": `Drug licence ${licence.form} ${licence.number} expired on ${new Date(licence.validTill).toLocaleDateString("en-IN")}. Upload the renewed licence to resume trading.`,
            "compliance.suspendedAt": now,
            "compliance.licenceWarnLevel": null,
          },
        },
      );
      await tell(
        b,
        "licence_expiring",
        { form: licence.form, days: 0 },
        licenceEmail({ businessName: b.tradeName || b.legalName, form: licence.form, number: licence.number, validTill: new Date(licence.validTill), daysLeft: 0 }),
      );
      suspended++;
      continue;
    }

    const level = dueLicenceWarning(daysLeft, b.compliance?.licenceWarnLevel);
    if (!level) continue;
    await Business.updateOne({ _id: b._id }, { $set: { "compliance.licenceWarnLevel": level } });
    await tell(
      b,
      "licence_expiring",
      { form: licence.form, days: daysLeft },
      licenceEmail({ businessName: b.tradeName || b.legalName, form: licence.form, number: licence.number, validTill: new Date(licence.validTill), daysLeft }),
    );
    warned++;
  }

  return { checked: businesses.length, warned, suspended };
}
