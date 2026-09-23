"use server";

import { revalidatePath } from "next/cache";
import { isValidObjectId } from "mongoose";
import { issueRecall, withdrawRecall } from "@/lib/recalls/service";
import { requirePlatformRole } from "@/lib/session";
import { recallSchema } from "@/lib/validation/recall";

export type RecallFormState = {
  ok?: boolean;
  error?: string;
  stats?: { listings: number; sellers: number; orders: number; buyers: number };
  values?: Record<string, string>;
};

export async function createRecall(_: RecallFormState, formData: FormData): Promise<RecallFormState> {
  const session = await requirePlatformRole("admin");
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = recallSchema.safeParse(raw);
  // React resets the form after an action, so hand the values back on failure.
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: raw };

  const recall = await issueRecall({
    ...parsed.data,
    user: { id: session.user.id, name: session.user.name },
  });
  revalidatePath("/admin/recalls");
  return {
    ok: true,
    stats: {
      listings: recall.stats?.listings ?? 0,
      sellers: recall.stats?.sellers ?? 0,
      orders: recall.stats?.orders ?? 0,
      buyers: recall.stats?.buyers ?? 0,
    },
  };
}

export async function revokeRecall(recallId: string) {
  const session = await requirePlatformRole("admin");
  if (!isValidObjectId(recallId)) return { error: "invalid" };
  const done = await withdrawRecall(recallId, session.user.id);
  revalidatePath("/admin/recalls");
  return done ? { ok: true } : { error: "not_found" };
}
