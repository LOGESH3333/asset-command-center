import { supabase } from '../client';
import type { Procurement } from '@/lib/brd/types';

export async function getProcurements(params: {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  const { status, search, page = 1, pageSize = 10 } = params;
  let query = supabase
    .from('procurements')
    .select('*, vendors(id, name), asset_requests(id, justification)', { count: 'exact' });

  if (status && status !== 'ALL') query = query.eq('status', status);
  if (search) query = query.ilike('title', `%${search}%`);

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);

  return { data: (data as Procurement[]) ?? [], error, total: count ?? 0 };
}

export async function getProcurement(id: string) {
  const { data, error } = await supabase
    .from('procurements')
    .select('*, vendors(id, name), asset_requests(id, justification)')
    .eq('id', id)
    .single();
  return { data: data as Procurement | null, error };
}
