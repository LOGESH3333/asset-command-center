import { supabase } from '../client';
import type { RequestApproval } from '@/lib/brd/types';

export async function getApprovals(params: {
  stage?: string;
  status?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  const { stage, status, page = 1, pageSize = 10 } = params;
  let query = supabase
    .from('request_approvals')
    .select('*, asset_requests(id, justification, status), users:approver_id(id, first_name, last_name)', { count: 'exact' });

  if (stage && stage !== 'ALL') query = query.eq('approval_stage', stage);
  if (status && status !== 'ALL') query = query.eq('status', status);

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);

  return { data: (data as RequestApproval[]) ?? [], error, total: count ?? 0 };
}

export async function getApproval(id: string) {
  const { data, error } = await supabase
    .from('request_approvals')
    .select('*, asset_requests(id, justification, status), users:approver_id(id, first_name, last_name)')
    .eq('id', id)
    .single();
  return { data: data as RequestApproval | null, error };
}

export async function getRequestsForApproval() {
  const { data, error } = await supabase
    .from('asset_requests')
    .select('id, justification, status')
    .order('created_at', { ascending: false });
  return { data: data ?? [], error };
}

export async function getRequestApprovalHistory(requestId: string) {
  const { data, error } = await supabase
    .from('request_approvals')
    .select(
      '*, users:approver_id(id, first_name, last_name, email)'
    )
    .eq('request_id', requestId)
    .order('created_at', { ascending: true });
  return { data: (data as RequestApproval[]) ?? [], error };
}
