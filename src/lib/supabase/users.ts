import { supabase } from './client';
import type { AppRole } from '@/lib/auth/roles';

export type User = {
  id: string;
  auth_id: string;
  email: string;
  first_name: string;
  last_name: string;
  department: string | null;
  role: AppRole;
  created_at: string;
  updated_at: string;
};

export interface GetUsersParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function getUsers({ search, page = 1, pageSize = 10 }: GetUsersParams = {}) {
  let query = supabase.from('users').select('*', { count: 'exact' });

  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,department.ilike.%${search}%`
    );
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  return { data: (data as User[]) ?? [], error, total: count ?? 0 };
}

export async function getUser(id: string) {
  const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
  return { data: data as User | null, error };
}

export async function getUserByAuthId(authId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('auth_id', authId)
    .maybeSingle();
  return { data: data as User | null, error };
}

export async function getRoleEnumValues(): Promise<AppRole[]> {
  return ['Super_Admin', 'Admin', 'Manager', 'Employee'];
}
