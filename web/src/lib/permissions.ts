/**
 * Business-level roles and what each may do. Checked on the server for every
 * mutation; the UI only uses these to hide controls.
 */
export const BUSINESS_TYPES = ["retailer", "wholesaler", "company"] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const MEMBER_ROLES = ["owner", "manager", "inventory", "billing", "viewer"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const PERMISSIONS = [
  "business.edit", // profile + KYC documents
  "team.manage", // invite / change role / remove staff
  "inventory.manage", // listings, stock, CSV import
  "orders.place", // retailer: cart + checkout
  "orders.manage", // seller: accept / dispatch
  "billing.view", // invoices, GST reports
  "analytics.view",
  "chat.use",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ALL = [...PERMISSIONS];

const ROLE_PERMISSIONS: Record<MemberRole, readonly Permission[]> = {
  owner: ALL,
  manager: ALL.filter((p) => p !== "team.manage" && p !== "business.edit"),
  inventory: ["inventory.manage", "orders.manage", "chat.use"],
  billing: ["orders.place", "billing.view", "chat.use"],
  viewer: ["analytics.view"],
};

export function can(role: MemberRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** Roles an owner may hand out (there is exactly one owner per business). */
export const ASSIGNABLE_ROLES = MEMBER_ROLES.filter((r) => r !== "owner");
