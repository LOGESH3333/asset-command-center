import type { AppRole } from './roles';
import { isAppRole } from './roles';

/** Super Admin env email — used to elevate Admin → Super_Admin in app layer. */
export function isSuperAdminEmail(email: string | null | undefined): boolean {
  const configured = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  if (!configured || !email) return false;
  return configured === email.trim().toLowerCase();
}

/**
 * Live DB may still use enum user_role (Admin, Manager, Employee).
 * Persist Super_Admin as Admin until migration converts role to TEXT.
 */
export function roleForDatabase(role: AppRole): string {
  return role;
}

function normalizeRoleString(role: string | null | undefined): AppRole {
  if (isAppRole(role)) return role;
  const lowered = role?.trim().toLowerCase().replace(/\s+/g, '_');
  if (lowered === 'super_admin' || lowered === 'superadmin') return 'Super_Admin';
  if (lowered === 'admin') return 'Admin';
  if (lowered === 'manager') return 'Manager';
  if (lowered === 'employee') return 'Employee';
  if (lowered === 'procurement' || lowered === 'finance') return 'Admin';
  return 'Employee';
}

/** Restore Super_Admin in app when the row belongs to the bootstrap email. */
export function roleFromDatabase(
  role: string | null | undefined,
  email?: string | null
): AppRole {
  if (isSuperAdminEmail(email)) return 'Super_Admin';

  const normalized = normalizeRoleString(role);
  if (normalized === 'Super_Admin') return 'Super_Admin';
  return normalized;
}

export function isRoleEnumError(error: { message?: string } | null | undefined): boolean {
  const msg = error?.message?.toLowerCase() ?? '';
  return msg.includes('user_role') || (msg.includes('enum') && msg.includes('role'));
}
