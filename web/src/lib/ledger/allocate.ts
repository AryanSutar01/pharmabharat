// Pure credit-ledger maths (no I/O) — unit tested in tests/ledger.test.ts.

import { round2 } from "@/lib/orders/gst";

export type OpenInvoice = {
  id: string;
  orderNo: string;
  /** Invoice total. */
  total: number;
  /** Already received against this invoice. */
  paid: number;
  /** When payment is due (used for ordering and for overdue maths). */
  dueAt: Date;
};

export type Allocation = { id: string; orderNo: string; amount: number; settles: boolean };

/**
 * Splits a receipt across open invoices, oldest due date first (the way a
 * shop's khata is settled). Anything left over stays "on account".
 */
export function allocatePayment(amount: number, invoices: OpenInvoice[]) {
  let left = round2(amount);
  const allocations: Allocation[] = [];
  const ordered = [...invoices].sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime() || a.orderNo.localeCompare(b.orderNo));

  for (const inv of ordered) {
    if (left <= 0) break;
    const owing = round2(inv.total - inv.paid);
    if (owing <= 0) continue;
    const take = round2(Math.min(owing, left));
    allocations.push({ id: inv.id, orderNo: inv.orderNo, amount: take, settles: take >= owing });
    left = round2(left - take);
  }
  return { allocations, unallocated: round2(Math.max(left, 0)) };
}

export type LedgerTotals = {
  invoiced: number;
  paid: number;
  outstanding: number;
  overdue: number;
  oldestDueAt: Date | null;
};

/** Totals for one buyer–seller account. `now` decides what counts as overdue. */
export function accountTotals(invoices: OpenInvoice[], receipts: number, now = new Date()): LedgerTotals {
  const invoiced = round2(invoices.reduce((a, i) => a + i.total, 0));
  const paid = round2(Math.min(receipts, invoiced));
  const outstanding = round2(invoices.reduce((a, i) => a + Math.max(i.total - i.paid, 0), 0));
  const overdueInvoices = invoices.filter((i) => i.total - i.paid > 0.009 && i.dueAt.getTime() < now.getTime());
  return {
    invoiced,
    paid,
    outstanding,
    overdue: round2(overdueInvoices.reduce((a, i) => a + (i.total - i.paid), 0)),
    oldestDueAt: overdueInvoices.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())[0]?.dueAt ?? null,
  };
}

/** Days past due for the oldest unpaid invoice (0 when nothing is overdue). */
export function daysOverdue(oldestDueAt: Date | null, now = new Date()) {
  if (!oldestDueAt) return 0;
  const days = Math.floor((now.getTime() - oldestDueAt.getTime()) / (24 * 3600 * 1000));
  return Math.max(days, 0);
}

/**
 * Can this buyer place another credit order?
 * A limit of 0 means the seller hasn't set one, so nothing is blocked.
 */
export function creditCheck(opts: { outstanding: number; creditLimit: number; orderTotal: number }) {
  const { outstanding, creditLimit, orderTotal } = opts;
  if (!(creditLimit > 0)) return { allowed: true, available: null as number | null };
  const available = round2(creditLimit - outstanding);
  return { allowed: round2(outstanding + orderTotal) <= creditLimit, available };
}
