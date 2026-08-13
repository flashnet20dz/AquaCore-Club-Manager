// Role definitions and permission helpers (safe for client and server)
// Multi-Tenant: includes superadmin role
export type Role = "superadmin" | "admin" | "assistant" | "lifeguard" | "observer" | "accountant";

export const ROLE_LABELS: Record<string, string> = {
  superadmin: "مدير عام",
  admin: "مدير النادي",
  assistant: "مساعد إداري",
  lifeguard: "حارس سباحة",
  observer: "مراقب",
  accountant: "محاسب مالي",
};

export const ROLE_ICONS: Record<string, string> = {
  superadmin: "🛡️",
  admin: "👑",
  assistant: "💼",
  lifeguard: "🏊",
  observer: "👁️",
  accountant: "💰",
};

// Check if user has permission for a feature
export function hasPermission(role: string | undefined, feature: string): boolean {
  if (!role) return false;
  // SuperAdmin has all permissions
  if (role === "superadmin") return true;
  const permissions: Record<string, string[]> = {
    dashboard: ["admin", "assistant", "lifeguard", "observer"],
    subscribers: ["admin", "assistant"],
    attendance: ["admin", "assistant", "lifeguard", "observer"],
    renewals: ["admin", "assistant"],
    export: ["admin", "assistant"],
    workHours: ["admin", "assistant", "lifeguard"],
    workHoursApproval: ["admin", "assistant"],
    // ★ Staff financial compensations — admin + assistant manage, lifeguard views own
    staffCompensations: ["admin", "assistant", "lifeguard"],
    staffCompensationsManage: ["admin", "assistant"],
    userManagement: ["admin"],
    settings: ["admin"],
    cards: ["admin", "assistant"],
    import: ["admin", "assistant"],
    charges: ["admin"],
    // ★ Financial system (المحاسب المالي)
    financialDashboard: ["admin", "accountant"],
    financialPayments: ["admin", "accountant"],
    financialReports: ["admin", "accountant", "assistant"],
  };
  return permissions[feature]?.includes(role) || false;
}

export function isSuperAdmin(role: string | undefined): boolean {
  return role === "superadmin";
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  phone?: string | null;
  clubId?: string | null;       // null for superadmin
  clubName?: string | null;     // cached club name for display
}
