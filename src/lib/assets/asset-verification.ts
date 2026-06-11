import { supabaseAdmin } from '@/lib/supabase/admin';
import { resolveSerialNumber } from './qr-code';

function formatEmployeeName(person: {
  first_name: string | null;
  last_name: string | null;
} | null): string | null {
  if (!person) return null;
  const name = `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim();
  return name || null;
}

export type AssetVerificationProfile = {
  name: string;
  asset_tag: string;
  serial_number: string;
  category: string | null;
  status: string;
  allocation_status: string;
  assigned_employee: string | null;
  department: string | null;
  purchase_date: string | null;
  warranty_expiry: string | null;
  warranty_label: string;
  updated_at: string;
};

type AssetRow = {
  id: string;
  asset_tag: string;
  name: string;
  serial_number: string | null;
  status: string;
  purchase_date: string | null;
  warranty_expiry: string | null;
  updated_at: string;
  category: { name: string } | { name: string }[] | null;
  employee: {
    first_name: string | null;
    last_name: string | null;
    department: string | null;
  } | {
    first_name: string | null;
    last_name: string | null;
    department: string | null;
  }[] | null;
};

type AllocationRow = {
  status: string;
  acknowledged_at: string | null;
  users: {
    first_name: string | null;
    last_name: string | null;
    department: string | null;
  } | {
    first_name: string | null;
    last_name: string | null;
    department: string | null;
  }[] | null;
};

function unwrapJoin<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function formatWarrantyLabel(expiry: string | null): string {
  if (!expiry) return 'No warranty on file';
  const date = new Date(expiry);
  if (Number.isNaN(date.getTime())) return 'No warranty on file';
  const formatted = date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const expired = date < new Date();
  return expired ? `Expired ${formatted}` : `Valid until ${formatted}`;
}

function deriveAllocationStatus(
  assetStatus: string,
  allocation: AllocationRow | null
): string {
  if (allocation) {
    if (allocation.acknowledged_at) return 'Assigned — Acknowledged';
    return 'Assigned — Pending Acknowledgment';
  }
  if (assetStatus === 'Allocated') return 'Allocated';
  if (assetStatus === 'Available') return 'Unassigned';
  if (assetStatus === 'Under Maintenance') return 'Unavailable — Maintenance';
  if (assetStatus === 'Retired') return 'Retired';
  return assetStatus;
}

export async function fetchAssetVerificationProfile(
  assetTag: string
): Promise<AssetVerificationProfile | null> {
  const decodedTag = decodeURIComponent(assetTag).trim();
  if (!decodedTag) return null;

  const { data, error } = await supabaseAdmin
    .from('assets')
    .select(`
      id,
      asset_tag,
      name,
      serial_number,
      status,
      purchase_date,
      warranty_expiry,
      updated_at,
      category:asset_categories(name),
      employee:users!assigned_employee_id(first_name, last_name, department)
    `)
    .eq('asset_tag', decodedTag)
    .maybeSingle();

  if (error || !data) return null;

  const asset = data as AssetRow;

  const { data: allocationData } = await supabaseAdmin
    .from('asset_allocations')
    .select('status, acknowledged_at, users:user_id(first_name, last_name, department)')
    .eq('asset_id', asset.id)
    .eq('status', 'Active')
    .order('allocated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const allocation = (allocationData as AllocationRow | null) ?? null;
  const allocationUser = unwrapJoin(allocation?.users ?? null);
  const assignedEmployee = unwrapJoin(asset.employee);

  const person = allocationUser ?? assignedEmployee;
  const category = unwrapJoin(asset.category);

  return {
    name: asset.name,
    asset_tag: asset.asset_tag,
    serial_number: resolveSerialNumber(asset),
    category: category?.name ?? null,
    status: asset.status,
    allocation_status: deriveAllocationStatus(asset.status, allocation),
    assigned_employee: formatEmployeeName(person),
    department: person?.department?.trim() || null,
    purchase_date: asset.purchase_date,
    warranty_expiry: asset.warranty_expiry,
    warranty_label: formatWarrantyLabel(asset.warranty_expiry),
    updated_at: asset.updated_at,
  };
}
