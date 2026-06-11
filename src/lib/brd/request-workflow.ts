import {
  REQUEST_STATUS,
  REQUEST_STATUS_AFTER_APPROVAL,
  type RequestStatus,
} from '@/lib/constants/request-status';
import type { ApprovalStage } from '@/lib/brd/types';

export const APPROVAL_STAGES: ApprovalStage[] = ['Manager', 'Procurement', 'Finance'];

/** Request status required before a stage can be decided. */
export const REQUEST_STATUS_FOR_STAGE: Record<ApprovalStage, RequestStatus> = {
  Manager: REQUEST_STATUS.PENDING_MANAGER,
  Procurement: REQUEST_STATUS.PENDING_PROCUREMENT,
  Finance: REQUEST_STATUS.PENDING_FINANCE,
};

export const NEXT_APPROVAL_STAGE: Partial<Record<ApprovalStage, ApprovalStage>> = {
  Manager: 'Procurement',
  Procurement: 'Finance',
};

export const STAGE_APPROVER_FIELDS: Record<
  ApprovalStage,
  {
    idField: 'manager_id' | 'procurement_id' | 'finance_id';
    dateField: 'manager_approval_date' | 'procurement_approval_date' | 'finance_approval_date';
  }
> = {
  Manager: { idField: 'manager_id', dateField: 'manager_approval_date' },
  Procurement: { idField: 'procurement_id', dateField: 'procurement_approval_date' },
  Finance: { idField: 'finance_id', dateField: 'finance_approval_date' },
};

/** Finance sign-off complete — procurement / PO may proceed. */
export function isFinanceApproved(status: string): boolean {
  return (
    status === REQUEST_STATUS.APPROVED ||
    status === REQUEST_STATUS.PURCHASING ||
    status === REQUEST_STATUS.RECEIVED ||
    status === REQUEST_STATUS.FULFILLED
  );
}

export function canStartProcurement(status: string): boolean {
  return status === REQUEST_STATUS.APPROVED;
}

export function canCreatePurchaseOrder(status: string): boolean {
  return (
    status === REQUEST_STATUS.APPROVED ||
    status === REQUEST_STATUS.PURCHASING
  );
}

export function canRegisterAssetForRequest(status: string): boolean {
  return (
    status === REQUEST_STATUS.APPROVED ||
    status === REQUEST_STATUS.PURCHASING ||
    status === REQUEST_STATUS.RECEIVED
  );
}

export function validateApprovalStageForRequest(
  stage: string,
  requestStatus: string
): string | null {
  const expected = REQUEST_STATUS_FOR_STAGE[stage as ApprovalStage];
  if (!expected) return `Unknown approval stage: ${stage}`;
  if (requestStatus !== expected) {
    return `Cannot act on ${stage} approval while request is "${requestStatus}". Expected "${expected}".`;
  }
  return null;
}

export function getApprovalStageForRequestStatus(requestStatus: string): ApprovalStage | null {
  const entry = (
    Object.entries(REQUEST_STATUS_FOR_STAGE) as [ApprovalStage, RequestStatus][]
  ).find(([, status]) => status === requestStatus);
  return entry?.[0] ?? null;
}

export function canActOnApproval(stage: string, requestStatus: string): boolean {
  return validateApprovalStageForRequest(stage, requestStatus) === null;
}

export function findActionablePendingApproval<
  T extends { status: string; approval_stage: string }
>(approvals: T[], requestStatus: string): T | undefined {
  const activeStage = getApprovalStageForRequestStatus(requestStatus);
  if (!activeStage) return undefined;
  return approvals.find(
    (approval) =>
      approval.status === 'Pending' && approval.approval_stage === activeStage
  );
}

export function getNextRequestStatusAfterApproval(stage: ApprovalStage): RequestStatus {
  return REQUEST_STATUS_AFTER_APPROVAL[stage] ?? REQUEST_STATUS.APPROVED;
}

export function getWorkflowStageLabel(stage: ApprovalStage): string {
  const labels: Record<ApprovalStage, string> = {
    Manager: 'Manager Approval',
    Procurement: 'Procurement Review',
    Finance: 'Finance Approval',
  };
  return labels[stage];
}

export function getWorkflowProgressSteps(currentStatus: string) {
  const status = currentStatus as RequestStatus;
  const pastManager = (
    [
      REQUEST_STATUS.PENDING_PROCUREMENT,
      REQUEST_STATUS.PENDING_FINANCE,
      REQUEST_STATUS.APPROVED,
      REQUEST_STATUS.PURCHASING,
      REQUEST_STATUS.RECEIVED,
      REQUEST_STATUS.FULFILLED,
    ] as string[]
  ).includes(status);

  return [
    { key: 'submitted', label: 'Employee Request', done: true },
    {
      key: 'manager',
      label: 'Manager Approval',
      done: pastManager,
      active: status === REQUEST_STATUS.PENDING_MANAGER,
    },
    {
      key: 'procurement',
      label: 'Procurement Review',
      done: (
        [
          REQUEST_STATUS.PENDING_FINANCE,
          REQUEST_STATUS.APPROVED,
          REQUEST_STATUS.PURCHASING,
          REQUEST_STATUS.RECEIVED,
          REQUEST_STATUS.FULFILLED,
        ] as string[]
      ).includes(status),
      active: status === REQUEST_STATUS.PENDING_PROCUREMENT,
    },
    {
      key: 'finance',
      label: 'Finance Approval',
      done: isFinanceApproved(status),
      active: status === REQUEST_STATUS.PENDING_FINANCE,
    },
    {
      key: 'purchase',
      label: 'Asset Purchase',
      done: (
        [REQUEST_STATUS.PURCHASING, REQUEST_STATUS.RECEIVED, REQUEST_STATUS.FULFILLED] as string[]
      ).includes(status),
      active: status === REQUEST_STATUS.APPROVED,
    },
    {
      key: 'registration',
      label: 'Asset Registration',
      done: ([REQUEST_STATUS.RECEIVED, REQUEST_STATUS.FULFILLED] as string[]).includes(status),
      active: status === REQUEST_STATUS.PURCHASING,
    },
    {
      key: 'allocation',
      label: 'Asset Allocation',
      done: status === REQUEST_STATUS.FULFILLED,
      active: status === REQUEST_STATUS.RECEIVED,
    },
    {
      key: 'acknowledgment',
      label: 'Employee Acknowledgment',
      done: status === REQUEST_STATUS.FULFILLED,
      active: false,
    },
  ];
}
