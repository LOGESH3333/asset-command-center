import { supabase } from './client';

export type MaintenanceRecord = {
  id: string;
  asset_id: string;
  type: 'Preventive' | 'Corrective' | string;
  description: string;
  cost: number | null;
  vendor_id: string | null;
  scheduled_date: string | null;
  completed_date: string | null;
  performed_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;

  // Joined fields
  assets?: {
    id: string;
    name: string;
    asset_tag: string;
  } | null;
  vendors?: {
    id: string;
    name: string;
  } | null;
};

export interface GetMaintenanceRecordsParams {
  search?: string;
  type?: string;
  page?: number;
  pageSize?: number;
}

export async function getMaintenanceRecords({ search, type, page = 1, pageSize = 10 }: GetMaintenanceRecordsParams = {}) {
  let query = supabase
    .from('maintenance_records')
    .select('*, assets(id, name, asset_tag), vendors(id, name)', { count: 'exact' });

  if (search) {
    query = query.or(`description.ilike.%${search}%,notes.ilike.%${search}%,performed_by.ilike.%${search}%`);
  }

  if (type) {
    query = query.eq('type', type);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  return {
    data: (data as any[]) ?? [],
    error,
    total: count ?? 0
  };
}

export async function getMaintenanceRecord(id: string) {
  const { data, error } = await supabase
    .from('maintenance_records')
    .select('*, assets(id, name, asset_tag), vendors(id, name)')
    .eq('id', id)
    .single();

  return { data: data as any | null, error };
}

export async function createMaintenanceRecord(record: Omit<MaintenanceRecord, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('maintenance_records')
    .insert([record])
    .select()
    .single();

  return { data: data as any | null, error };
}

export async function updateMaintenanceRecord(
  id: string,
  updates: Partial<Omit<MaintenanceRecord, 'id' | 'created_at' | 'updated_at'>>
) {
  const { data, error } = await supabase
    .from('maintenance_records')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  return { data: data as any | null, error };
}

export async function deleteMaintenanceRecord(id: string) {
  const { error } = await supabase
    .from('maintenance_records')
    .delete()
    .eq('id', id);

  return { error };
}
