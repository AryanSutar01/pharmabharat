"use server";

import { revalidatePath } from "next/cache";
import { Types, isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongo";
import { LedgerError, recordPayment, setCreditTerms } from "@/lib/ledger/service";
import { Order } from "@/lib/models/order";
import { creditTermsSchema, recordPaymentSchema } from "@/lib/validation/ledger";
import { requireBusiness } from "@/lib/session";

export type LedgerFormState = { ok?: boolean; error?: string };

/** The seller may only touch accounts of buyers they have actually traded with. */
async function sellerAccount(buyerId: string) {
  const { business, session } = await requireBusiness({ permission: "billing.view" });
  if (!isValidObjectId(buyerId)) return null;
  await connectDB();
  const buyer = new Types.ObjectId(buyerId);
  if (!(await Order.exists({ sellerId: business._id, buyerId: buyer }))) return null;
  return { seller: business, buyerId: buyer, user: { id: session.user.id, name: session.user.name } };
}

export async function recordPaymentAction(_: LedgerFormState, formData: FormData): Promise<LedgerFormState> {
  const parsed = recordPaymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const ctx = await sellerAccount(parsed.data.buyerId);
  if (!ctx) return { error: "not_found" };

  try {
    await recordPayment({
      seller: ctx.seller,
      buyerId: ctx.buyerId,
      amount: parsed.data.amount,
      method: parsed.data.method,
      reference: parsed.data.reference,
      note: parsed.data.note,
      receivedAt: parsed.data.receivedAt,
      user: ctx.user,
    });
  } catch (e) {
    return { error: e instanceof LedgerError ? e.code : "server_error" };
  }

  revalidatePath("/app/ledger");
  revalidatePath(`/app/ledger/${parsed.data.buyerId}`);
  revalidatePath("/app/orders");
  return { ok: true };
}

export async function saveCreditTermsAction(_: LedgerFormState, formData: FormData): Promise<LedgerFormState> {
  const parsed = creditTermsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const ctx = await sellerAccount(parsed.data.buyerId);
  if (!ctx) return { error: "not_found" };

  await setCreditTerms({
    sellerId: ctx.seller._id,
    buyerId: ctx.buyerId,
    creditLimit: parsed.data.creditLimit,
    creditDays: parsed.data.creditDays,
    note: parsed.data.note,
    userId: ctx.user.id,
  });
  revalidatePath(`/app/ledger/${parsed.data.buyerId}`);
  return { ok: true };
}
