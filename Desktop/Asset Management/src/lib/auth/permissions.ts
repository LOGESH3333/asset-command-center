import type { AppRole } from './roles';

/** Route prefix → roles allowed (Admin always has full access). */
const ROUTE_ACCESS: Record<string, AppRole[]> = {
  '/dashboard': ['Admin', 'Manager', 'Procurement', 'Finance', 'Employee'],
  '/dashboard/assets': ['Admin', 'Manager', 'Procurement', 'Finance', 'Employee'],
  '/dashboard/inventory': ['Admin', 'Manager', 'Procurement'],
  '/dashboard/categories': ['Admin', 'Manager', 'Procurement'],
  '/dashboard/vendors': ['Admin', 'Manager', 'Procurement'],
  '/dashboard/requests': ['Admin', 'Manager', 'Procurement', 'Finance', 'Employee'],
  '/dashboard/approvals': ['Admin', 'Manager', 'Finance'],
  '/dashboard/allocations': ['Admin', 'Manager', 'Procurement', 'Finance', 'Employee'],
  '/dashboard/maintenance': ['Admin', 'Manager', 'Procurement', 'Employee'],
  '/dashboard/disposals': ['Admin', 'Manager'],
  '/dashboard/procurement': ['Admin', 'Manager', 'Procurement', 'Finance'],
  '/dashboard/purchase-orders': ['Admin', 'Manager', 'Procurement', 'Finance'],
  '/dashboard/reports': ['Admin', 'Manager', 'Finance'],
  '/dashboard/notifications': ['Admin', 'Manager', 'Procurement', 'Finance', 'Employee'],
  '/dashboard/audit-logs': ['Admin', 'Manager', 'Finance'],
  '/dashboard/users': ['Admin', 'Manager'],
  '/dashboard/settings': ['Admin'],
};

const ROUTE_ORDER = Object.keys(ROUTE_ACCESS).sort((a, b) => b.length - a.length);

export function canAccessRoute(role: AppRole | null | undefined, pathname: string): boolean {
  if (!role) return false;
  if (role === 'Admin') return true;

  const match = ROUTE_ORDER.find(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  if (!match) return true;
  return ROUTE_ACCESS[match].includes(role);
}

export function isNavVisible(role: AppRole | null | undefined, href: string): boolean {
  return canAccessRoute(role, href);
}

export function rolesForAction(action: keyof typeof ACTION_ROLES): AppRole[] {
  return ACTION_ROLES[action];
}

const ACTION_ROLES = {
  manageUsers: ['Admin'] as AppRole[],
  manageSettings: ['Admin'] as AppRole[],
  manageAssets: ['Admin', 'Manager'] as AppRole[],
  manageInventory: ['Admin', 'Manager', 'Procurement'] as AppRole[],
  manageVendors: ['Admin', 'Manager', 'Procurement'] as AppRole[],
  manageProcurement: ['Admin', 'Manager', 'Procurement'] as AppRole[],
  viewProcurement: ['Admin', 'Manager', 'Procurement', 'Finance'] as AppRole[],
  manageApprovals: ['Admin', 'Manager', 'Finance'] as AppRole[],
  manageAllocations: ['Admin', 'Manager'] as AppRole[],
  viewReports: ['Admin', 'Manager', 'Finance'] as AppRole[],
  viewAudit: ['Admin', 'Manager', 'Finance'] as AppRole[],
  submitRequest: ['Admin', 'Manager', 'Employee'] as AppRole[],
};
