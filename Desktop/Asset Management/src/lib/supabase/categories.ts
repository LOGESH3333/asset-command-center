import { supabase } from './client';

export type Category = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export interface GetCategoriesParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function getCategories({ search, page = 1, pageSize = 10 }: GetCategoriesParams = {}) {
  let query = supabase.from('asset_categories').select('*', { count: 'exact' });

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  return { data: (data as Category[]) ?? [], error, total: count ?? 0 };
}

export async function getCategory(id: string) {
  const { data, error } = await supabase
    .from('asset_categories')
    .select('*')
    .eq('id', id)
    .single();
  return { data: data as Category | null, error };
}

export async function createCategory(name: string) {
  const { data, error } = await supabase
    .from('asset_categories')
    .insert([{ name }])
    .select()
    .single();
  return { data: data as Category | null, error };
}

export async function updateCategory(id: string, name: string) {
  const { data, error } = await supabase
    .from('asset_categories')
    .update({ name })
    .eq('id', id)
    .select()
    .single();
  return { data: data as Category | null, error };
}

export async function deleteCategory(id: string) {
  const { error } = await supabase
    .from('asset_categories')
    .delete()
    .eq('id', id);
  return { error };
}
