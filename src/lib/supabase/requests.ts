import { supabase } from './client';
import { DEFAULT_REQUEST_STATUS, type RequestStatus } from '@/lib/constants/request-status';

export type AssetRequest = {
  id: string;
  requester_id: string | null;
  category_id: string | null;
  justification: string;
  priority: 'Low' | 'Medium' | 'High' | string;
  status: RequestStatus | string;
  manager_id: string | null;
  procurement_id: string | null;
  finance_id: string | null;
  manager_approval_date: string | null;
  procurement_approval_date: string | null;
  finance_approval_date: string | null;
  rejection_reason: string | null;
  fulfilled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AssetRequestLookup = Pick<AssetRequest, 'id' | 'justification' | 'status'>;

export type RequesterProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  department: string | null;
};

export type CategoryProfile = {
  id: string;
  name: string;
};

export type AssetRequestWithRelations = AssetRequest & {
  requester?: RequesterProfile | null;
  category?: CategoryProfile | null;
};

const REQUEST_RELATIONS_SELECT = `
  *,
  requester:users!requester_id(id, first_name, last_name, email, department),
  category:asset_categories!category_id(id, name)
`;

export type AssetRequestInsert = {
  justification: string;
  requester_id?: string | null;
  category_id?: string | null;
  status?: RequestStatus;
  priority?: string;
  created_at?: string;
};

export type AssetRequestUpdate = Partial<
  Pick<
    AssetRequest,
    | 'justification'
    | 'requester_id'
    | 'category_id'
    | 'status'
    | 'priority'
    | 'rejection_reason'
  >
>;

/** Short label for tables, selects, and activity feeds. */
export function formatRequestLabel(justification: string | null | undefined, maxLen = 80): string {
  if (!justification?.trim()) return 'Untitled request';
  const text = justification.trim();
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
}

export interface GetRequestsParams {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export async function getRequests({ search, status, page = 1, pageSize = 10 }: GetRequestsParams = {}) {
  let query = supabase.from('asset_requests').select('*', { count: 'exact' });

  if (search) {
    query = query.ilike('justification', `%${search}%`);
  }

  if (status) {
    query = query.eq('status', status);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to)
    .limit(pageSize);

  return { data: (data as AssetRequest[]) ?? [], error, total: count ?? 0 };
}

export async function getRequest(id: string) {
  const { data, error } = await supabase
    .from('asset_requests')
    .select(REQUEST_RELATIONS_SELECT)
    .eq('id', id)
    .single();
  return { data: data as AssetRequestWithRelations | null, error };
}

export async function createRequest(request: AssetRequestInsert) {
  const { data, error } = await supabase
    .from('asset_requests')
    .insert([{ ...request, status: request.status ?? DEFAULT_REQUEST_STATUS }])
    .select()
    .single();
  return { data: data as AssetRequest | null, error };
}

export async function updateRequest(id: string, updates: AssetRequestUpdate) {
  const { data, error } = await supabase
    .from('asset_requests')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  return { data: data as AssetRequest | null, error };
}

export async function deleteRequest(id: string) {
  const { error } = await supabase
    .from('asset_requests')
    .delete()
    .eq('id', id);
  return { error };
}
