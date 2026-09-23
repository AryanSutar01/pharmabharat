/** Client-safe recall constants (the model and forms both import these). */
export const RECALL_SEVERITIES = ["recall", "advisory"] as const;
export type RecallSeverity = (typeof RECALL_SEVERITIES)[number];
