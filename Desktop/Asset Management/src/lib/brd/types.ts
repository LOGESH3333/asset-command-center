/** Shared TypeScript types for BRD modules */

import type { RequestStatus } from '@/lib/constants/request-status';

export type AllocationStatus = 'Active' | 'Returned';

export type AssetAllocation = {
  id: string;
  asset_id: string;
  user_id: string | null;
  allocated_at: string;
  returned_at: string | null;
  status: AllocationStatus | string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  assets?: { id: string; name: string; asset_tag: string } | null;
  users?: { id: string; first_name: string; last_name: string } | null;
};

export type ApprovalStage = 'Manager' | 'Procurement' | 'Finance';
export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected';

export type RequestApproval = {
  id: string;
  request_id: string;
  approver_id: string | null;
  approval_stage: ApprovalStage | string;
  status: ApprovalStatus | string;
  comments: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
  asset_requests?: { id: string; justification: string; status: RequestStatus | string } | null;
  users?: { id: string; first_name: string; last_name: string } | null;
};

export type ProcurementStatus = 'Draft' | 'Submitted' | 'Approved' | 'Ordered' | 'Closed' | 'Cancelled';

export type Procurement = {
  id: string;
  request_id: string | null;
  title: string;
  description: string | null;
  status: ProcurementStatus | string;
  priority: string;
  requester_id: string | null;
  vendor_id: string | null;
  estimated_cost: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  vendors?: { id: string; name: string } | null;
  asset_requests?: { id: string; justification: string } | null;
};

export type PurchaseOrderStatus = 'Draft' | 'Sent' | 'Received' | 'Cancelled';

export type PurchaseOrder = {
  id: string;
  procurement_id: string | null;
  po_number: string;
  vendor_id: string | null;
  total_amount: number | null;
  status: PurchaseOrderStatus | string;
  order_date: string | null;
  expected_delivery: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  vendors?: { id: string; name: string } | null;
  procurements?: { id: string; title: string } | null;
};

export type InventoryItem = {
  id: string;
  name: string;
  sku: string | null;
  category_id: string | null;
  vendor_id: string | null;
  quantity_on_hand: number;
  reorder_level: number;
  unit_cost: number | null;
  location: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  asset_categories?: { id: string; name: string } | null;
  vendors?: { id: string; name: string } | null;
};

export type DisposalStatus = 'Pending' | 'Approved' | 'Completed' | 'Rejected';
export type DisposalMethod = 'Recycle' | 'Donate' | 'Sell' | 'Destroy' | 'Other';

export type AssetDisposal = {
  id: string;
  asset_id: string;
  reason: string;
  disposal_method: DisposalMethod | string | null;
  status: DisposalStatus | string;
  requested_by: string | null;
  approved_by: string | null;
  disposal_date: string | null;
  salvage_value: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  assets?: { id: string; name: string; asset_tag: string } | null;
};
