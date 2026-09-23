/** Client-safe ledger constants (the model imports these, not the other way round). */
export const PAYMENT_METHODS = ["cash", "upi", "bank", "cheque", "adjustment"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
