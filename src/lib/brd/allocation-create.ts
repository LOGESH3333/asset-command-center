import 'server-only';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { formatAuditTriggerDbError } from '@/lib/supabase/audit-db-errors';

type AllocationInput = {
  asset_id: string;
  user_id: string;
  notes?: string | null;
};

export type AllocationCreateResult =
  | { data: { id: string }; error?: undefined; debug?: Record<string, unknown> }
  | { data?: undefined; error: string };

function formatErrorWithStack(step: string, error: unknown): string {
  if (error instanceof Error) {
    return `[${step}] ${error.message}\n${error.stack ?? ''}`;
  }
  if (typeof error === 'object' && error !== null) {
    return `[${step}] ${JSON.stringify(error, null, 2)}`;
  }
  return `[${step}] ${String(error)}`;
}

function formatAllocationDbError(message: string) {
  if (message.includes('allocated_at') && message.includes('does not exist')) {
    return 'Database schema is missing allocation columns. Run supabase/migrations/008_asset_allocations_columns.sql in the Supabase SQL Editor, then try again.';
  }
  if (
    message.includes('create_asset_allocation_transaction') ||
    message.includes('function') && message.includes('does not exist')
  ) {
    return 'Database allocation transaction is missing. Run supabase/migrations/024_allocation_consistency_transaction.sql in the Supabase SQL Editor, then try again.';
  }
  return formatAuditTriggerDbError(message);
}

function logAllocationFailure(
  phase: string,
  input: AllocationInput,
  error: { message?: string; code?: string; details?: string | null; hint?: string | null } | string
) {
  const normalized =
    typeof error === 'string'
      ? { message: error }
      : {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        };

  console.error('[allocation-create] failed', {
    phase,
    asset_id: input.asset_id,
    user_id: input.user_id,
    notes: input.notes ?? null,
    ...normalized,
  });
}

export async function createAssetAllocationRow(
  input: AllocationInput
): Promise<AllocationCreateResult> {
  if (!input.asset_id || !input.user_id) {
    return { error: '[allocation:validation] Asset and employee are required.' };
  }

  const { data: asset, error: assetError } = await supabaseAdmin
    .from('assets')
    .select('id, asset_tag, status')
    .eq('id', input.asset_id)
    .maybeSingle();

  if (assetError) {
    logAllocationFailure('validate_asset', input, assetError);
    return { error: formatErrorWithStack('allocation:validate_asset', assetError) };
  }
  if (!asset?.id) {
    logAllocationFailure('validate_asset', input, 'Selected asset was not found.');
    return { error: '[allocation:validate_asset] Selected asset was not found.' };
  }

  const { data: user, error: userError } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('id', input.user_id)
    .maybeSingle();

  if (userError) {
    logAllocationFailure('validate_user', input, userError);
    return { error: formatErrorWithStack('allocation:validate_user', userError) };
  }
  if (!user?.id) {
    logAllocationFailure('validate_user', input, 'Selected employee was not found.');
    return { error: '[allocation:validate_user] Selected employee was not found.' };
  }

  const { data, error } = await supabaseAdmin.rpc(
    'create_asset_allocation_transaction',
    {
      p_asset_id: input.asset_id,
      p_user_id: input.user_id,
      p_notes: input.notes?.trim() || null,
    }
  );

  if (error) {
    logAllocationFailure('transaction_rpc', input, error);
    return { error: formatErrorWithStack('allocation:transaction_rpc', error) };
  }
  if (!data || typeof data !== 'string') {
    logAllocationFailure('transaction_rpc', input, 'Allocation transaction did not return an id.');
    return { error: '[allocation:transaction_rpc] Allocation transaction did not return an id.' };
  }

  const { data: allocationReadback, error: allocationReadbackError } = await supabaseAdmin
    .from('asset_allocations')
    .select('id, asset_id, user_id, status, allocated_at, notes')
    .eq('id', data)
    .maybeSingle();

  console.log('[allocation-create] allocation-readback', {
    allocation_id: data,
    data: allocationReadback,
    error: allocationReadbackError,
  });
  if (allocationReadbackError) {
    return {
      error: formatErrorWithStack('allocation:readback', allocationReadbackError),
    };
  }

  const { data: auditReadback, error: auditReadbackError } = await supabaseAdmin
    .from('audit_logs')
    .select('id, action, table_name, record_id, created_at')
    .eq('table_name', 'asset_allocations')
    .eq('record_id', data)
    .order('created_at', { ascending: false })
    .limit(1);

  console.log('[allocation-create] audit-readback', {
    allocation_id: data,
    data: auditReadback,
    error: auditReadbackError,
  });
  if (auditReadbackError) {
    return {
      error: formatErrorWithStack('allocation:audit_readback', auditReadbackError),
    };
  }

  return {
    data: { id: data },
    debug: {
      allocation: allocationReadback,
      audit_log: auditReadback?.[0] ?? null,
    },
  };
}
