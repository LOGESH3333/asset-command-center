export type AppRole =
  | 'Super_Admin'
  | 'Admin'
  | 'Manager'
  | 'Employee';

export const ROLES: AppRole[] = [
  'Super_Admin',
  'Admin',
  'Manager',
  'Employee',
];

export const INVITABLE_ROLES: AppRole[] = ['Admin', 'Manager', 'Employee'];

export function isAppRole(value: string | null | undefined): value is AppRole {
  return ROLES.includes(value as AppRole);
}

export function isSuperAdmin(role: AppRole | null | undefined) {
  return role === 'Super_Admin';
}

export function canManageUsers(role: AppRole | null | undefined) {
  return role === 'Super_Admin';
}

export function canInviteUsers(role: AppRole | null | undefined) {
  return role === 'Super_Admin';
}

export function canManageSettings(role: AppRole | null | undefined) {
  return role === 'Super_Admin';
}

export function canApproveRequests(role: AppRole | null | undefined) {
  return role === 'Super_Admin' || role === 'Admin' || role === 'Manager';
}

export function canManageAssets(role: AppRole | null | undefined) {
  return role === 'Super_Admin' || role === 'Admin' || role === 'Manager';
}

export function canViewReports(role: AppRole | null | undefined) {
  return role === 'Super_Admin' || role === 'Manager';
}

export function canManageAllocations(role: AppRole | null | undefined) {
  return role === 'Super_Admin' || role === 'Admin' || role === 'Manager';
}

export function canManageApprovals(role: AppRole | null | undefined) {
  return role === 'Super_Admin' || role === 'Admin' || role === 'Manager';
}

export function canManageProcurement(role: AppRole | null | undefined) {
  return role === 'Super_Admin' || role === 'Admin';
}

export function canViewProcurement(role: AppRole | null | undefined) {
  return role === 'Super_Admin' || role === 'Admin';
}

export function canManageInventory(role: AppRole | null | undefined) {
  return role === 'Super_Admin' || role === 'Admin';
}

export function canApproveDisposal(role: AppRole | null | undefined) {
  return role === 'Super_Admin' || role === 'Admin' || role === 'Manager';
}

export function canViewAuditLogs(role: AppRole | null | undefined) {
  return role === 'Super_Admin';
}

export function canViewTeam(role: AppRole | null | undefined) {
  return role === 'Super_Admin' || role === 'Admin' || role === 'Manager';
}

export function formatRoleLabel(role: AppRole): string {
  return role.split('_').join(' ').toUpperCase();
}
