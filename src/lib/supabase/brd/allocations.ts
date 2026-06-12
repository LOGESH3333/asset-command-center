import { supabase } from '../client';
import type { AssetAllocation } from '@/lib/brd/types';

export async function getAllocations(params: {
  status?: string;
  page?: number;
  pageSize?: number;
  userId?: string;
} = {}) {
  const { status, page = 1, pageSize = 10, userId } = params;
  let query = supabase
    .from('asset_allocations')
    .select('*, assets(id, name, asset_tag), users:user_id(id, first_name, last_name)', { count: 'exact' });

  if (userId) query = query.eq('user_id', userId);
  if (status && status !== 'ALL') query = query.eq('status', status);

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query
    .order('allocated_at', { ascending: false })
    .range(from, from + pageSize - 1);

  return { data: (data as AssetAllocation[]) ?? [], error, total: count ?? 0 };
}

export async function getAllocation(id: string) {
  const { data, error } = await supabase
    .from('asset_allocations')
    .select('*, assets(id, name, asset_tag), users:user_id(id, first_name, last_name)')
    .eq('id', id)
    .maybeSingle();
  return { data: data as AssetAllocation | null, error };
}
