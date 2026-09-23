import "server-only";
import type mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongo";
import { Bill } from "@/lib/models/bill";

/**
 * Schedules that must be entered in the shop's register when dispensed.
 * H and H1 are prescription-only; H1 additionally needs a bound register with
 * the prescriber and patient (Drugs and Cosmetics Rules, Schedule H1).
 */
export const REGISTER_SCHEDULES = ["h", "h1", "x"] as const;
export type RegisterSchedule = (typeof REGISTER_SCHEDULES)[number];

export type RegisterRow = {
  billId: string;
  billNo: string;
  date: string;
  medicine: string;
  batchNo: string;
  expiryDate: string;
  schedule: string;
  qty: number;
  patientName: string;
  patientPhone: string;
  doctorName: string;
  registrationNo: string;
  /** True when a scheduled medicine went out without the prescriber recorded. */
  incomplete: boolean;
};

/**
 * Every dispensing of a scheduled medicine in the period, one row per line,
 * oldest first — the order an inspector expects to read it in.
 */
export async function registerRows(
  businessId: mongoose.Types.ObjectId,
  opts: { from: Date; to: Date; schedule?: RegisterSchedule; limit?: number } = { from: new Date(0), to: new Date() },
): Promise<RegisterRow[]> {
  await connectDB();
  const schedules = opts.schedule ? [opts.schedule] : [...REGISTER_SCHEDULES];

  const bills = await Bill.find(
    {
      businessId,
      status: "final",
      createdAt: { $gte: opts.from, $lte: opts.to },
      "lines.schedule": { $in: schedules },
    },
    { billNo: 1, createdAt: 1, lines: 1, customer: 1, prescription: 1 },
  )
    .sort({ createdAt: 1 })
    .limit(opts.limit ?? 2000)
    .lean();

  return bills.flatMap((b) =>
    b.lines
      .filter((l) => schedules.includes((l.schedule ?? "").toLowerCase() as RegisterSchedule))
      .map((l) => ({
        billId: String(b._id),
        billNo: b.billNo,
        date: new Date(b.createdAt).toISOString(),
        medicine: l.name,
        batchNo: l.batchNo,
        expiryDate: new Date(l.expiryDate).toISOString(),
        schedule: (l.schedule ?? "").toUpperCase(),
        qty: l.qty,
        patientName: b.prescription?.patientName || b.customer?.name || "",
        patientPhone: b.customer?.phone ?? "",
        doctorName: b.prescription?.doctorName ?? "",
        registrationNo: b.prescription?.registrationNo ?? "",
        incomplete: !b.prescription?.doctorName,
      })),
  );
}

const csvCell = (v: string | number) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** The register as CSV, for the shop's own records or an inspection. */
export function registerCsv(rows: RegisterRow[]) {
  const header = [
    "Date",
    "Bill no",
    "Medicine",
    "Schedule",
    "Batch",
    "Expiry",
    "Qty",
    "Patient",
    "Phone",
    "Prescriber",
    "Reg. no",
  ];
  const lines = rows.map((r) =>
    [
      new Date(r.date).toLocaleString("en-IN"),
      r.billNo,
      r.medicine,
      r.schedule,
      r.batchNo,
      new Date(r.expiryDate).toLocaleDateString("en-IN"),
      r.qty,
      r.patientName,
      r.patientPhone,
      r.doctorName,
      r.registrationNo,
    ]
      .map(csvCell)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

/** Prescriptions recorded for one customer, newest first. */
export async function customerPrescriptions(businessId: mongoose.Types.ObjectId, customerId: string, limit = 20) {
  await connectDB();
  const bills = await Bill.find(
    { businessId, customerId, status: "final", "prescription.doctorName": { $nin: [null, ""] } },
    { billNo: 1, createdAt: 1, prescription: 1, lines: 1 },
  )
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return bills.map((b) => ({
    billId: String(b._id),
    billNo: b.billNo,
    date: new Date(b.createdAt).toISOString(),
    doctorName: b.prescription?.doctorName ?? "",
    registrationNo: b.prescription?.registrationNo ?? "",
    medicines: b.lines
      .filter((l) => REGISTER_SCHEDULES.includes((l.schedule ?? "").toLowerCase() as RegisterSchedule))
      .map((l) => `${l.name} × ${l.qty}`),
  }));
}
