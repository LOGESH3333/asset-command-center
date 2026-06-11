import { supabase } from '../client';
import type { AssetDisposal } from '@/lib/brd/types';

export async function getDisposals(params: {
  status?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  const { status, page = 1, pageSize = 10 } = params;
  let query = supabase
    .from('asset_disposals')
    .select('*, assets(id, name, asset_tag)', { count: 'exact' });

  if (status && status !== 'ALL') query = query.eq('status', status);

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);

  return { data: (data as AssetDisposal[]) ?? [], error, total: count ?? 0 };
}

export async function getDisposal(id: string) {
  const { data, error } = await supabase
    .from('asset_disposals')
    .select('*, assets(id, name, asset_tag)')
    .eq('id', id)
    .single();
  return { data: data as AssetDisposal | null, error };
}
