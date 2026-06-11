import { supabase } from './client';

export type Vendor = {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string;
  updated_at: string;
};

export type VendorInsert = {
  name: string;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

export type VendorUpdate = Partial<VendorInsert>;

export type VendorLookup = Pick<Vendor, 'id' | 'name'>;

/** Prefer canonical `email`, fall back to legacy `contact_email`. */
export function getVendorEmail(vendor: Pick<Vendor, 'email' | 'contact_email'> | null | undefined): string | null {
  if (!vendor) return null;
  return vendor.email?.trim() || vendor.contact_email?.trim() || null;
}

/** Prefer canonical `phone`, fall back to legacy `contact_phone`. */
export function getVendorPhone(vendor: Pick<Vendor, 'phone' | 'contact_phone'> | null | undefined): string | null {
  if (!vendor) return null;
  return vendor.phone?.trim() || vendor.contact_phone?.trim() || null;
}

export interface GetVendorsParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function getVendors({ search, page = 1, pageSize = 10 }: GetVendorsParams = {}) {
  let query = supabase.from('vendors').select('*', { count: 'exact' });

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  return { data: (data as Vendor[]) ?? [], error, total: count ?? 0 };
}

export async function getVendor(id: string) {
  const { data, error } = await supabase
    .from('vendors')
    .select('*')
    .eq('id', id)
    .single();
  return { data: data as Vendor | null, error };
}

export async function createVendor(vendor: VendorInsert) {
  const { data, error } = await supabase
    .from('vendors')
    .insert([vendor])
    .select()
    .single();
  return { data: data as Vendor | null, error };
}

export async function updateVendor(id: string, updates: VendorUpdate) {
  const { data, error } = await supabase
    .from('vendors')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  return { data: data as Vendor | null, error };
}

export async function deleteVendor(id: string) {
  const { error } = await supabase.from('vendors').delete().eq('id', id);
  return { error };
}
