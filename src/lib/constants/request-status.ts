/** Matches Supabase `public.request_status` enum — do not use legacy values like "Pending" or "Fulfilled". */

export const REQUEST_STATUS = {
  PENDING_MANAGER: 'Pending Manager',
  PENDING_PROCUREMENT: 'Pending Procurement',
  PENDING_FINANCE: 'Pending Finance',
  APPROVED: 'Approved',
  PURCHASING: 'Purchasing',
  RECEIVED: 'Received',
  FULFILLED: 'Fulfilled',
  REJECTED: 'Rejected',
} as const;

export type RequestStatus = (typeof REQUEST_STATUS)[keyof typeof REQUEST_STATUS];

export const DEFAULT_REQUEST_STATUS: RequestStatus = REQUEST_STATUS.PENDING_MANAGER;

/** Statuses awaiting an approval stage — used for dashboard KPIs and filters. */
export const PENDING_REQUEST_STATUSES: RequestStatus[] = [
  REQUEST_STATUS.PENDING_MANAGER,
  REQUEST_STATUS.PENDING_PROCUREMENT,
  REQUEST_STATUS.PENDING_FINANCE,
];

export const REQUEST_STATUS_OPTIONS: { value: RequestStatus; label: string }[] = [
  { value: REQUEST_STATUS.PENDING_MANAGER, label: 'Pending Manager' },
  { value: REQUEST_STATUS.PENDING_PROCUREMENT, label: 'Pending Procurement' },
  { value: REQUEST_STATUS.PENDING_FINANCE, label: 'Pending Finance' },
  { value: REQUEST_STATUS.APPROVED, label: 'Approved' },
  { value: REQUEST_STATUS.PURCHASING, label: 'Purchasing' },
  { value: REQUEST_STATUS.RECEIVED, label: 'Received' },
  { value: REQUEST_STATUS.FULFILLED, label: 'Fulfilled' },
  { value: REQUEST_STATUS.REJECTED, label: 'Rejected' },
];

/** Statuses eligible for linking a new procurement case (finance approval complete). */
export const PROCUREMENT_ELIGIBLE_STATUSES: RequestStatus[] = [REQUEST_STATUS.APPROVED];

/** Next `asset_requests.status` after a stage is approved. */
export const REQUEST_STATUS_AFTER_APPROVAL: Record<
  'Manager' | 'Procurement' | 'Finance',
  RequestStatus
> = {
  Manager: REQUEST_STATUS.PENDING_PROCUREMENT,
  Procurement: REQUEST_STATUS.PENDING_FINANCE,
  Finance: REQUEST_STATUS.APPROVED,
};

export function isPendingRequestStatus(status: string): boolean {
  return (PENDING_REQUEST_STATUSES as string[]).includes(status);
}
