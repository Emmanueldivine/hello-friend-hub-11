export const ADMIN_PERMISSIONS = [
  { key: "students", label: "Students" },
  { key: "vendors", label: "Vendors" },
  { key: "orders", label: "Orders" },
  { key: "assignments", label: "Assignments" },
  { key: "wallets", label: "Wallets & Revenue" },
  { key: "chats", label: "Chats & Disputes" },
] as const;

export type AdminPermissionKey = (typeof ADMIN_PERMISSIONS)[number]["key"];

/** Areas only the super admin may ever open. */
export const SUPER_ADMIN_ONLY = ["subadmins", "settings"] as const;

export const naira = (value: number | string | null | undefined) =>
  "\u20a6" + Number(value ?? 0).toLocaleString("en-NG", { maximumFractionDigits: 0 });
