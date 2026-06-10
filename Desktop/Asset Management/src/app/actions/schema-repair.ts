'use server';

import { revalidatePath } from 'next/cache';
import { WRITE_AUDIT_LOG_FUNCTION_SQL } from '@/lib/supabase/sql/write-audit-log-function';

const REPAIR_STATEMENTS = [
  `ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid()`,
  `UPDATE public.assets SET id = gen_random_uuid() WHERE id IS NULL`,
  `CREATE TABLE IF NOT EXISTS public.maintenance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'Preventive',
    description TEXT NOT NULL DEFAULT '',
    cost NUMERIC(12, 2),
    vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
    scheduled_date DATE,
    completed_date DATE,
    performed_by TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS description TEXT`,
  `ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS performed_by TEXT`,
  `ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS notes TEXT`,
  `ALTER TABLE public.asset_allocations ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE SET NULL`,
  `ALTER TABLE public.asset_allocations ADD COLUMN IF NOT EXISTS allocated_at TIMESTAMPTZ`,
  `ALTER TABLE public.asset_allocations ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ`,
  `ALTER TABLE public.asset_allocations ADD COLUMN IF NOT EXISTS notes TEXT`,
  `ALTER TABLE public.asset_allocations ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active'`,
  `ALTER TABLE public.asset_allocations ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ`,
  `ALTER TABLE public.asset_allocations ADD COLUMN IF NOT EXISTS acknowledged_by UUID REFERENCES public.users(id) ON DELETE SET NULL`,
  `UPDATE public.asset_allocations SET allocated_at = COALESCE(allocated_at, created_at, now()) WHERE allocated_at IS NULL`,
  `UPDATE public.asset_allocations SET status = COALESCE(NULLIF(TRIM(status), ''), 'Active') WHERE status IS NULL OR TRIM(status) = ''`,
  `ALTER TABLE public.asset_allocations ALTER COLUMN allocated_at SET DEFAULT now()`,
  `CREATE INDEX IF NOT EXISTS idx_allocations_status ON public.asset_allocations(status)`,
  WRITE_AUDIT_LOG_FUNCTION_SQL,
  `NOTIFY pgrst, 'reload schema'`,
];

function getProjectRef(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match?.[1] ?? null;
}

export async function repairDatabaseSchemaAction(): Promise<{ success?: boolean; message?: string; error?: string }> {
  const password = process.env.SUPABASE_DB_PASSWORD;
  const ref = getProjectRef();

  if (!password || !ref) {
    return {
      error:
        'Add SUPABASE_DB_PASSWORD to .env.local (Supabase Dashboard → Project Settings → Database → Database password), then click Repair Schema again. Request submission works without it via fallback mode.',
    };
  }

  try {
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
    for (const sql of REPAIR_STATEMENTS) {
      await client.query(sql);
    }
    await client.end();

    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard/requests');
    revalidatePath('/dashboard/allocations');
    revalidatePath('/dashboard/inventory');
    revalidatePath('/dashboard/audit-logs');
    return {
      success: true,
      message: 'Database maintenance completed and PostgREST schema cache refreshed.',
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Schema repair failed. Run pending migrations in the Supabase SQL Editor instead.',
    };
  }
}

export async function getSchemaRepairSqlAction(): Promise<{ sql: string }> {
  return {
    sql: REPAIR_STATEMENTS.join(';\n') + ';',
  };
}
