import type { AppRole } from './roles';
import { isSuperAdmin } from './roles';

/** Route prefix → roles allowed. Super_Admin bypasses all checks. */
const ROUTE_ACCESS: Record<string, AppRole[]> = {
  '/dashboard': ['Super_Admin', 'Admin', 'Manager', 'Employee'],
  '/dashboard/assets': ['Super_Admin', 'Admin', 'Manager'],
  '/dashboard/inventory': ['Super_Admin', 'Admin'],
  '/dashboard/categories': ['Super_Admin', 'Admin'],
  '/dashboard/vendors': ['Super_Admin', 'Admin'],
  '/dashboard/requests': ['Super_Admin', 'Admin', 'Manager', 'Employee'],
  '/dashboard/approvals': ['Super_Admin', 'Admin', 'Manager'],
  '/dashboard/allocations': ['Super_Admin', 'Admin', 'Manager', 'Employee'],
  '/dashboard/maintenance': ['Super_Admin', 'Admin'],
  '/dashboard/disposals': ['Super_Admin', 'Admin', 'Manager'],
  '/dashboard/procurement': ['Super_Admin', 'Admin'],
  '/dashboard/purchase-orders': ['Super_Admin', 'Admin'],
  '/dashboard/reports': ['Super_Admin', 'Admin', 'Manager'],
  '/dashboard/notifications': ['Super_Admin', 'Admin', 'Manager', 'Employee'],
  '/dashboard/audit-logs': ['Super_Admin'],
  '/dashboard/users': ['Super_Admin'],
  '/dashboard/user-management': ['Super_Admin'],
  '/dashboard/settings': ['Super_Admin'],
};

const ROUTE_ORDER = Object.keys(ROUTE_ACCESS).sort((a, b) => b.length - a.length);

function isOwnProfileView(pathname: string, profileId?: string | null): boolean {
  if (!profileId) return false;
  const match = pathname.match(/^\/dashboard\/users\/([^/]+)$/);
  return match !== null && match[1] === profileId;
}

export function canAccessRoute(
  role: AppRole | null | undefined,
  pathname: string,
  profileId?: string | null
): boolean {
  if (!role) return false;
  if (isSuperAdmin(role)) return true;
  if (isOwnProfileView(pathname, profileId)) return true;
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
  manageUsers: ['Super_Admin'] as AppRole[],
  inviteUsers: ['Super_Admin'] as AppRole[],
  manageSettings: ['Super_Admin'] as AppRole[],
  manageAssets: ['Super_Admin', 'Admin', 'Manager'] as AppRole[],
  manageInventory: ['Super_Admin', 'Admin'] as AppRole[],
  manageVendors: ['Super_Admin', 'Admin'] as AppRole[],
  manageProcurement: ['Super_Admin', 'Admin'] as AppRole[],
  viewProcurement: ['Super_Admin', 'Admin'] as AppRole[],
  manageApprovals: ['Super_Admin', 'Admin', 'Manager'] as AppRole[],
  manageAllocations: ['Super_Admin', 'Admin', 'Manager'] as AppRole[],
  viewReports: ['Super_Admin', 'Admin', 'Manager'] as AppRole[],
  viewAudit: ['Super_Admin'] as AppRole[],
  submitRequest: ['Super_Admin', 'Admin', 'Manager', 'Employee'] as AppRole[],
};
