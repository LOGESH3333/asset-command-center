import { supabase } from './client';

export type Category = { id: string; name: string };
export type Vendor = { id: string; name: string };
export type Employee = { id: string; first_name: string; last_name: string; department: string | null };
export type AssetLookup = { id: string; name: string; asset_tag: string };

export async function getCategories() {
  const { data, error } = await supabase.from('asset_categories').select('id, name');
  return { data, error };
}

export async function getVendors() {
  const { data, error } = await supabase.from('vendors').select('id, name');
  return { data, error };
}

export async function getEmployees() {
  const { data, error } = await supabase
    .from('users')
    .select('id, first_name, last_name, department')
    .order('first_name');
  return { data, error };
}

export async function getAssetsLookup() {
  const { data, error } = await supabase
    .from('assets')
    .select('id, name, asset_tag')
    .order('asset_tag');
  return { data, error };
}
