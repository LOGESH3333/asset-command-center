import { supabase } from '../supabase/client';

export type Asset = {
  id: string;
  asset_tag: string;
  name: string;
  category_id: string | null;
  vendor_id: string | null;
  cost: number | null;
  purchase_date: string | null; // ISO date string
  warranty_expiry: string | null; // ISO date string
  status: 'Available' | 'Allocated' | 'Under Maintenance' | 'Retired';
  assigned_employee_id: string | null;
  request_id?: string | null;
  serial_number?: string | null;
  qr_payload?: string | null;
  qr_generated_at?: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export interface GetAssetsParams {
  search?: string; // matches asset_tag or name (case‑insensitive)
  status?: Asset['status'];
  page?: number; // 1‑based
  pageSize?: number; // defaults to 10
}

export interface GetAssetsResult {
  data: Asset[];
  error: { message: string } | null;
  total: number;
}

/** Fetch assets with optional search, status filter, pagination, sorted by created_at desc */
export async function getAssets({ search, status, page = 1, pageSize = 10 }: GetAssetsParams): Promise<GetAssetsResult> {
  let query = supabase.from('assets').select('*', { count: 'exact' });

  if (search) {
    const searchPattern = `%${search}%`;
    query = query.or(`asset_tag.ilike.${searchPattern},name.ilike.${searchPattern}`);
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

  return { data: (data as Asset[]) ?? [], error, total: count ?? 0 };
}

/** Fetch a single asset by its primary key (asset_tag) */
export async function getAsset(assetTag: string) {
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('asset_tag', assetTag)
    .single();
  return { data: data as Asset | null, error };
}

/** Create a new asset record */
export async function createAsset(asset: Omit<Asset, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase.from('assets').insert([asset]).select().single();
  return { data: data as Asset | null, error };
}

/** Update an existing asset */
export async function updateAsset(assetTag: string, updates: Partial<Omit<Asset, 'asset_tag' | 'created_at' | 'updated_at'>>) {
  const { data, error } = await supabase
    .from('assets')
    .update(updates)
    .eq('asset_tag', assetTag)
    .single();
  return { data: data as Asset | null, error };
}

/** Delete an asset */
export async function deleteAsset(assetTag: string) {
  const { data, error } = await supabase.from('assets').delete().eq('asset_tag', assetTag).single();
  return { data, error };
}
