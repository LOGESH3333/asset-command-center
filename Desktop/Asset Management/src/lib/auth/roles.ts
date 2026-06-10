export type AppRole = 'Admin' | 'Manager' | 'Employee';

export const ROLES: AppRole[] = ['Admin', 'Manager', 'Employee'];

export function canManageUsers(role: AppRole | null | undefined) {
  return role === 'Admin';
}

export function canApproveRequests(role: AppRole | null | undefined) {
  return role === 'Admin' || role === 'Manager';
}

export function canManageAssets(role: AppRole | null | undefined) {
  return role === 'Admin' || role === 'Manager';
}

export function canViewReports(role: AppRole | null | undefined) {
  return role === 'Admin' || role === 'Manager';
}

export function canManageAllocations(role: AppRole | null | undefined) {
  return role === 'Admin' || role === 'Manager';
}

export function canManageApprovals(role: AppRole | null | undefined) {
  return role === 'Admin' || role === 'Manager';
}

export function canManageProcurement(role: AppRole | null | undefined) {
  return role === 'Admin' || role === 'Manager';
}

export function canManageInventory(role: AppRole | null | undefined) {
  return role === 'Admin' || role === 'Manager';
}

export function canApproveDisposal(role: AppRole | null | undefined) {
  return role === 'Admin' || role === 'Manager';
}
