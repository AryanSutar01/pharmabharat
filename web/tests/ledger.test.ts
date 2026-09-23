import { describe, expect, it } from "vitest";
import { accountTotals, allocatePayment, creditCheck, daysOverdue, type OpenInvoice } from "@/lib/ledger/allocate";

const day = (n: number) => new Date(2026, 0, n);
const inv = (orderNo: string, total: number, paid: number, due: number): OpenInvoice => ({
  id: orderNo,
  orderNo,
  total,
  paid,
  dueAt: day(due),
});

describe("allocatePayment", () => {
  const open = [inv("B", 500, 0, 20), inv("A", 1000, 200, 10), inv("C", 300, 0, 30)];

  it("settles the oldest due invoice first", () => {
    const { allocations, unallocated } = allocatePayment(900, open);
    expect(allocations).toEqual([
      { id: "A", orderNo: "A", amount: 800, settles: true }, // 1000 − 200 already paid
      { id: "B", orderNo: "B", amount: 100, settles: false },
    ]);
    expect(unallocated).toBe(0);
  });

  it("marks part payments as not settling", () => {
    const { allocations } = allocatePayment(500, open);
    expect(allocations).toEqual([{ id: "A", orderNo: "A", amount: 500, settles: false }]);
  });

  it("keeps an overpayment on account", () => {
    const { allocations, unallocated } = allocatePayment(2000, open);
    expect(allocations.map((a) => a.amount)).toEqual([800, 500, 300]);
    expect(unallocated).toBe(400);
  });

  it("skips invoices that are already settled", () => {
    const { allocations } = allocatePayment(100, [inv("A", 500, 500, 10), inv("B", 200, 0, 20)]);
    expect(allocations).toEqual([{ id: "B", orderNo: "B", amount: 100, settles: false }]);
  });

  it("handles paise without drift", () => {
    const { allocations, unallocated } = allocatePayment(0.3, [inv("A", 0.1, 0, 1), inv("B", 0.2, 0, 2)]);
    expect(allocations.map((a) => a.amount)).toEqual([0.1, 0.2]);
    expect(unallocated).toBe(0);
  });
});

describe("accountTotals", () => {
  it("separates outstanding from overdue", () => {
    const now = day(25);
    const t = accountTotals([inv("A", 1000, 200, 10), inv("B", 500, 0, 30)], 200, now);
    expect(t).toMatchObject({ invoiced: 1500, paid: 200, outstanding: 1300, overdue: 800 });
    expect(t.oldestDueAt).toEqual(day(10));
    expect(daysOverdue(t.oldestDueAt, now)).toBe(15);
  });

  it("reports nothing overdue when everything is within terms", () => {
    const t = accountTotals([inv("A", 1000, 0, 30)], 0, day(25));
    expect(t.overdue).toBe(0);
    expect(daysOverdue(t.oldestDueAt, day(25))).toBe(0);
  });
});

describe("creditCheck", () => {
  it("blocks an order that would cross the limit", () => {
    expect(creditCheck({ outstanding: 8000, creditLimit: 10000, orderTotal: 2500 })).toEqual({ allowed: false, available: 2000 });
    expect(creditCheck({ outstanding: 8000, creditLimit: 10000, orderTotal: 2000 })).toEqual({ allowed: true, available: 2000 });
  });

  it("allows everything when no limit is set", () => {
    expect(creditCheck({ outstanding: 99999, creditLimit: 0, orderTotal: 5000 })).toEqual({ allowed: true, available: null });
  });
});
