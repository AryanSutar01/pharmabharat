"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BillingError, createBill, searchShelf, type ShelfHit } from "@/lib/retail/billing";
import { createCustomer, searchCustomers, type CustomerHit } from "@/lib/retail/customers";
import { requireShop } from "@/lib/retail/guard";
import { customerSchema } from "@/lib/validation/customer";

export type BillResult = { ok?: boolean; billId?: string; error?: string; detail?: string };

const objectId = z.string().regex(/^[a-f0-9]{24}$/i);

const billSchema = z.object({
  lines: z
    .array(
      z.object({
        stockId: objectId,
        qty: z.number().int().min(1).max(10_000),
        discountPercent: z.number().min(0).max(100).default(0),
      }),
    )
    .min(1)
    .max(60),
  customerId: objectId.optional(),
  payment: z.object({ mode: z.enum(["cash", "upi", "card"]), received: z.number().min(0).max(10_000_000).optional() }),
  prescription: z
    .object({
      doctorName: z.string().trim().max(120).optional(),
      registrationNo: z.string().trim().max(60).optional(),
      patientName: z.string().trim().max(120).optional(),
    })
    .optional(),
});

/** Type-ahead over the shop's own shelf. */
export async function shelfSearch(q: string): Promise<ShelfHit[]> {
  const { business } = await requireShop("retail.sell");
  return searchShelf(business._id, q);
}

export async function customerSearch(q: string): Promise<CustomerHit[]> {
  const { business } = await requireShop("retail.sell");
  return searchCustomers(business._id, q);
}

export type CustomerFormState = { ok?: boolean; customer?: CustomerHit; errors?: Record<string, string> };

/** Quick add at the counter: name, phone and the consent tick. */
export async function addCustomer(_: CustomerFormState, formData: FormData): Promise<CustomerFormState> {
  const { business, session } = await requireShop("retail.sell");
  const parsed = customerSchema.safeParse({
    ...Object.fromEntries(formData),
    conditions: formData.getAll("conditions"),
    consent: formData.get("consent") === "on",
    reminders: formData.get("reminders") === "on",
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? "form")] = issue.message;
    return { errors };
  }
  if (!parsed.data.consent) return { errors: { consent: "consent_required" } };

  const { customer } = await createCustomer(business._id, parsed.data, session.user.id);
  return {
    ok: true,
    customer: {
      id: String(customer._id),
      name: customer.name,
      phone: customer.phone ?? "",
      email: customer.email ?? "",
      points: customer.loyaltyPoints ?? 0,
      visits: customer.visits ?? 0,
      conditions: customer.conditions ?? [],
      reminders: Boolean(customer.consent?.reminders),
    },
  };
}

export async function saveBill(payload: unknown): Promise<BillResult> {
  const { business, session } = await requireShop("retail.sell");
  const parsed = billSchema.safeParse(payload);
  if (!parsed.success) return { error: "invalid" };

  try {
    const bill = await createBill(business._id, parsed.data, { id: session.user.id, name: session.user.name });
    revalidatePath("/app/shop/stock");
    revalidatePath("/app/shop/bills");
    return { ok: true, billId: String(bill._id) };
  } catch (err) {
    if (err instanceof BillingError) return { error: err.code, detail: err.detail };
    throw err;
  }
}
