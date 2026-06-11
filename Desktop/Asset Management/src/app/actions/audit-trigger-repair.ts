'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { AUDIT_TRIGGER_REPAIR_SQL } from '@/lib/supabase/sql/write-audit-log-function';
import { isStaleAuditTriggerError } from '@/lib/supabase/audit-db-errors';

function getProjectRef(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match?.[1] ?? null;
}

async function withPgClient<T>(fn: (query: (sql: string) => Promise<unknown>) => Promise<T>): Promise<T> {
  const password = process.env.SUPABASE_DB_PASSWORD;
  const ref = getProjectRef();

  if (!password || !ref) {
    throw new Error(
      'Add SUPABASE_DB_PASSWORD to .env.local (Supabase → Project Settings → Database → Database password), then retry.'
    );
  }

  const { Client } = await import('pg');
  const client = new Client({
    host: `db.${ref}.supabase.co`,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    return await fn((sql) => client.query(sql));
  } finally {
    await client.end();
  }
}

export async function getAuditLogTriggerFixSqlAction(): Promise<{ sql: string }> {
  return { sql: AUDIT_TRIGGER_REPAIR_SQL };
}

export async function repairAuditLogTriggerAction(): Promise<{
  success?: boolean;
  message?: string;
  error?: string;
}> {
  try {
    await withPgClient(async (query) => {
      await query(AUDIT_TRIGGER_REPAIR_SQL);
    });

    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard/inventory');
    revalidatePath('/dashboard/approvals');
    revalidatePath('/dashboard/audit-logs');

    const verify = await verifyAuditLogTriggerAction();
    if (!verify.ok) {
      return {
        error: verify.error ?? 'Function updated but verification insert still failed.',
      };
    }

    return {
      success: true,
      message:
        'write_audit_log() redeployed: record_id uses UUID (NEW.id/OLD.id), old_data/new_data payloads. Audited inserts should work.',
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Audit trigger repair failed.',
    };
  }
}

async function smokeInsertInventory() {
  const sku = `VERIFY-${Date.now()}`;
  const { data, error } = await supabaseAdmin
    .from('inventory')
    .insert([{ name: '__audit_verify__', quantity_on_hand: 1, sku }])
    .select('id')
    .single();
  if (error) return { ok: false as const, error: error.message };
  if (data?.id) await supabaseAdmin.from('inventory').delete().eq('id', data.id);
  return { ok: true as const };
}

async function smokeInsertApproval() {
  const { data: req } = await supabaseAdmin.from('asset_requests').select('id').limit(1).maybeSingle();
  if (!req?.id) return { ok: true as const, skipped: true };
  const { data, error } = await supabaseAdmin
    .from('request_approvals')
    .insert([
      {
        request_id: req.id,
        approval_stage: 'Manager',
        status: 'Pending',
        comments: '__audit_verify__',
      },
    ])
    .select('id')
    .single();
  if (error) return { ok: false as const, error: error.message };
  if (data?.id) await supabaseAdmin.from('request_approvals').delete().eq('id', data.id);
  return { ok: true as const };
}

export async function verifyAuditLogTriggerAction(): Promise<{
  ok: boolean;
  error?: string;
  staleTrigger?: boolean;
}> {
  for (const smoke of [smokeInsertInventory, smokeInsertApproval]) {
    const result = await smoke();
    if (!result.ok) {
      return {
        ok: false,
        error: result.error,
        staleTrigger: isStaleAuditTriggerError(result.error ?? ''),
      };
    }
  }
  return { ok: true };
}

export async function inspectAuditLogTriggerAction(): Promise<{
  ok?: boolean;
  staleTrigger?: boolean;
  error?: string;
  functionUsesDetails?: boolean;
  functionUsesTextRecordId?: boolean;
  functionDefinition?: string | null;
}> {
  try {
    let def: string | null = null;
    await withPgClient(async (query) => {
      const result = (await query(`
        SELECT pg_get_functiondef(oid) AS def
        FROM pg_proc
        WHERE proname = 'write_audit_log'
          AND pronamespace = 'public'::regnamespace
      `)) as { rows: { def: string }[] };
      def = result.rows[0]?.def ?? null;
    });
    const usesDetails = def ? /\bdetails\b/i.test(def) : undefined;
    const usesTextRecordId = def
      ? /rec_id\s+TEXT/i.test(def) || /::text/i.test(def) || /asset_tag/i.test(def)
      : undefined;

    const verify = await verifyAuditLogTriggerAction();

    return {
      ok: verify.ok,
      staleTrigger: verify.staleTrigger ?? usesDetails ?? usesTextRecordId,
      error: verify.error,
      functionUsesDetails: usesDetails,
      functionUsesTextRecordId: usesTextRecordId,
      functionDefinition: def,
    };
  } catch (err) {
    const verify = await verifyAuditLogTriggerAction();
    return {
      ok: verify.ok,
      staleTrigger: verify.staleTrigger,
      error: err instanceof Error ? err.message : 'Inspection failed',
    };
  }
}
