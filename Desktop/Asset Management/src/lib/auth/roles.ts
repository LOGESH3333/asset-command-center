export type AppRole = 'Admin' | 'Manager' | 'Procurement' | 'Finance' | 'Employee';

export const ROLES: AppRole[] = ['Admin', 'Manager', 'Procurement', 'Finance', 'Employee'];

export function isAppRole(value: string | null | undefined): value is AppRole {
  return ROLES.includes(value as AppRole);
}

export function canManageUsers(role: AppRole | null | undefined) {
  return role === 'Admin';
}

export function canApproveRequests(role: AppRole | null | undefined) {
  return role === 'Admin' || role === 'Manager' || role === 'Finance';
}

export function canManageAssets(role: AppRole | null | undefined) {
  return role === 'Admin' || role === 'Manager';
}

export function canViewReports(role: AppRole | null | undefined) {
  return role === 'Admin' || role === 'Manager' || role === 'Finance';
}

export function canManageAllocations(role: AppRole | null | undefined) {
  return role === 'Admin' || role === 'Manager';
}

export function canManageApprovals(role: AppRole | null | undefined) {
  return role === 'Admin' || role === 'Manager' || role === 'Finance';
}

export function canManageProcurement(role: AppRole | null | undefined) {
  return role === 'Admin' || role === 'Manager' || role === 'Procurement';
}

export function canViewProcurement(role: AppRole | null | undefined) {
  return role === 'Admin' || role === 'Manager' || role === 'Procurement' || role === 'Finance';
}

export function canManageInventory(role: AppRole | null | undefined) {
  return role === 'Admin' || role === 'Manager' || role === 'Procurement';
}

export function canApproveDisposal(role: AppRole | null | undefined) {
  return role === 'Admin' || role === 'Manager';
}

export function canViewAuditLogs(role: AppRole | null | undefined) {
  return role === 'Admin' || role === 'Manager' || role === 'Finance';
}

export function canViewTeam(role: AppRole | null | undefined) {
  return role === 'Admin' || role === 'Manager';
}
