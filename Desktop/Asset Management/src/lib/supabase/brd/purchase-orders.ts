import { supabase } from '../client';
import type { PurchaseOrder } from '@/lib/brd/types';

export async function getPurchaseOrders(params: {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  const { status, search, page = 1, pageSize = 10 } = params;
  let query = supabase
    .from('purchase_orders')
    .select('*, vendors(id, name), procurements(id, title)', { count: 'exact' });

  if (status && status !== 'ALL') query = query.eq('status', status);
  if (search) query = query.ilike('po_number', `%${search}%`);

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);

  return { data: (data as PurchaseOrder[]) ?? [], error, total: count ?? 0 };
}

export async function getPurchaseOrder(id: string) {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('*, vendors(id, name), procurements(id, title)')
    .eq('id', id)
    .single();
  return { data: data as PurchaseOrder | null, error };
}

export async function getProcurementsLookup() {
  const { data, error } = await supabase
    .from('procurements')
    .select('id, title, status')
    .order('created_at', { ascending: false });
  return { data: data ?? [], error };
}
