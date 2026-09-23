"use server";

import { revalidatePath } from "next/cache";
import { isValidObjectId } from "mongoose";
import { requireShop } from "@/lib/retail/guard";
import { anonymiseCustomer, createCustomer, updateCustomer } from "@/lib/retail/customers";
import { customerSchema } from "@/lib/validation/customer";

export type CustomerState = { ok?: boolean; errors?: Record<string, string>; customerId?: string };

function parse(formData: FormData) {
  return customerSchema.safeParse({
    ...Object.fromEntries(formData),
    conditions: formData.getAll("conditions"),
    consent: formData.get("consent") === "on",
    reminders: formData.get("reminders") === "on",
  });
}

export async function saveCustomer(_: CustomerState, formData: FormData): Promise<CustomerState> {
  const { business, session } = await requireShop("retail.manage");
  const parsed = parse(formData);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? "form")] = issue.message;
    return { errors };
  }
  if (!parsed.data.consent) return { errors: { consent: "consent_required" } };

  const id = String(formData.get("customerId") ?? "");
  if (id) {
    if (!isValidObjectId(id)) return { errors: { form: "not_found" } };
    const updated = await updateCustomer(business._id, id, parsed.data);
    if (!updated) return { errors: { form: "not_found" } };
    revalidatePath(`/app/shop/customers/${id}`);
    revalidatePath("/app/shop/customers");
    return { ok: true, customerId: id };
  }

  const { customer } = await createCustomer(business._id, parsed.data, session.user.id);
  revalidatePath("/app/shop/customers");
  return { ok: true, customerId: String(customer._id) };
}

/** DPDP erasure — wipes the personal details and scrubs old bills. */
export async function deleteCustomer(customerId: string) {
  const { business } = await requireShop("retail.manage");
  if (!isValidObjectId(customerId)) return { error: "invalid" };
  const done = await anonymiseCustomer(business._id, customerId);
  revalidatePath("/app/shop/customers");
  return done ? { ok: true } : { error: "not_found" };
}
