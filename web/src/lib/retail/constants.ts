/** Client-safe retail constants (models and forms both import these). */
export const CUSTOMER_CONDITIONS = ["diabetes", "hypertension", "thyroid", "cardiac", "asthma", "arthritis", "other"] as const;
export type CustomerCondition = (typeof CUSTOMER_CONDITIONS)[number];

export const BILL_PAYMENT_MODES = ["cash", "upi", "card"] as const;
export type BillPaymentMode = (typeof BILL_PAYMENT_MODES)[number];
