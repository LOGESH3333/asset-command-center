import { supabase } from '../client';
import type { InventoryItem } from '@/lib/brd/types';

export async function getInventoryItems(params: {
  search?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  const { search, page = 1, pageSize = 10 } = params;
  let query = supabase
    .from('inventory')
    .select('*, asset_categories(id, name), vendors(id, name)', { count: 'exact' });

  if (search) query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query
    .order('name')
    .range(from, from + pageSize - 1);

  return { data: (data as InventoryItem[]) ?? [], error, total: count ?? 0 };
}

export async function getInventoryItem(id: string) {
  const { data, error } = await supabase
    .from('inventory')
    .select('*, asset_categories(id, name), vendors(id, name)')
    .eq('id', id)
    .single();
  return { data: data as InventoryItem | null, error };
}
