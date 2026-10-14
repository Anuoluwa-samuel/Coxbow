/**
 * Role-based permissions. Server code checks `can()`; the UI uses it only to hide controls.
 * Keep this matrix small and explicit.
 */
export type Role = "admin" | "manager" | "cleaner";

export type Permission =
  | "dashboard.view"
  | "bookings.read"
  | "bookings.read_assigned"
  | "bookings.manage" // approve, reject, reschedule, cancel, confirm, assign
  | "bookings.update_progress" // start / complete assigned jobs
  | "quotations.manage"
  | "customers.read"
  | "services.read"
  | "services.write"
  | "areas.write"
  | "settings.write"
  | "staff.manage"
  | "payments.read"
  | "payments.record"
  | "payments.refund"
  | "users.manage"
  | "audit.read"
  | "notes.write";

const matrix: Record<Role, readonly Permission[]> = {
  admin: [
    "dashboard.view", "bookings.read", "bookings.manage", "bookings.update_progress", "quotations.manage",
    "customers.read", "services.read", "services.write", "areas.write", "settings.write", "staff.manage",
    "payments.read", "payments.record", "payments.refund", "users.manage", "audit.read", "notes.write",
  ],
  manager: [
    "dashboard.view", "bookings.read", "bookings.manage", "bookings.update_progress", "quotations.manage",
    "customers.read", "services.read", "staff.manage", "payments.read", "payments.record", "notes.write",
  ],
  cleaner: ["bookings.read_assigned", "bookings.update_progress"],
};

export function can(role: Role | undefined | null, permission: Permission): boolean {
  return role ? matrix[role].includes(permission) : false;
}
