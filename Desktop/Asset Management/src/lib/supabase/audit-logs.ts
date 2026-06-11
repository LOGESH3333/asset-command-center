import { supabase } from './client';

export type AuditLogActor = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

export type AuditLog = {
  id: string;
  action: string;
  table_name: string;
  record_id: string | null;
  user_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
  actor?: AuditLogActor | null;
};

const AUDIT_LOG_SELECT = `
  *,
  actor:users!user_id(id, first_name, last_name, email)
`;

export interface GetAuditLogsParams {
  search?: string;
  action?: string;
  table_name?: string;
  page?: number;
  pageSize?: number;
}

export async function getAuditLogs({ search, action, table_name, page = 1, pageSize = 10 }: GetAuditLogsParams = {}) {
  let query = supabase
    .from('audit_logs')
    .select(AUDIT_LOG_SELECT, { count: 'exact' });

  if (search) {
    query = query.or(
      `action.ilike.%${search}%,table_name.ilike.%${search}%,record_id.ilike.%${search}%`
    );
  }

  if (action) {
    query = query.eq('action', action);
  }

  if (table_name) {
    query = query.eq('table_name', table_name);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  return { data: (data as AuditLog[]) ?? [], error, total: count ?? 0 };
}

export async function getAuditLogActions() {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('action')
    .limit(100);

  const unique = [...new Set((data ?? []).map((d: { action: string }) => d.action))];
  return { data: unique, error };
}

export async function getAuditLogTables() {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('table_name')
    .limit(100);

  const unique = [...new Set((data ?? []).map((d: { table_name: string }) => d.table_name))];
  return { data: unique, error };
}
