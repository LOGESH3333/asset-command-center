'use server';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { requireBrdRole } from './_auth';
import { createBrdNotification } from '@/lib/brd/notify';
import { formatAuditTriggerDbError } from '@/lib/supabase/audit-db-errors';

function revalidateDisposals() {
  revalidatePath('/dashboard/disposals');
  revalidatePath('/dashboard/assets');
}

export async function createDisposalAction(input: {
  asset_id: string;
  reason: string;
  disposal_method?: string | null;
  disposal_date?: string | null;
  salvage_value?: number | null;
  notes?: string | null;
}) {
  const auth = await requireBrdRole(['Admin', 'Manager', 'Employee']);
  if (auth.error) return { error: auth.error };

  if (!input.asset_id || !input.reason?.trim()) {
    return { error: 'Asset and reason are required.' };
  }

  const { data, error } = await supabaseAdmin
    .from('asset_disposals')
    .insert([
      {
        asset_id: input.asset_id,
        reason: input.reason.trim(),
        disposal_method: input.disposal_method || null,
        disposal_date: input.disposal_date || null,
        salvage_value: input.salvage_value ?? null,
        notes: input.notes?.trim() || null,
        requested_by: auth.profile?.id ?? null,
        status: 'Pending',
      },
    ])
    .select('id')
    .single();

  if (error) return { error: formatAuditTriggerDbError(error.message) };

  await createBrdNotification({
    title: 'Disposal requested',
    message: 'A new asset disposal request requires review.',
  });

  revalidateDisposals();
  return { success: true, id: data?.id };
}

export async function decideDisposalAction(
  id: string,
  decision: 'Approved' | 'Rejected' | 'Completed'
) {
  const auth = await requireBrdRole(['Admin', 'Manager']);
  if (auth.error) return { error: auth.error };

  const { data: disposal, error } = await supabaseAdmin
    .from('asset_disposals')
    .update({
      status: decision,
      approved_by: auth.profile?.id ?? null,
      disposal_date: decision === 'Completed' ? new Date().toISOString().slice(0, 10) : undefined,
    })
    .eq('id', id)
    .select('asset_id')
    .single();

  if (error) return { error: formatAuditTriggerDbError(error.message) };

  if (decision === 'Completed' && disposal?.asset_id) {
    await supabaseAdmin
      .from('assets')
      .update({ status: 'Retired', assigned_employee_id: null })
      .eq('id', disposal.asset_id);
  }

  await createBrdNotification({
    title: `Disposal ${decision.toLowerCase()}`,
    message: `Asset disposal request has been ${decision.toLowerCase()}.`,
  });

  revalidateDisposals();
  return { success: true };
}

export async function deleteDisposalAction(id: string) {
  const auth = await requireBrdRole(['Admin']);
  if (auth.error) return { error: auth.error };

  const { error } = await supabaseAdmin.from('asset_disposals').delete().eq('id', id);
  if (error) return { error: formatAuditTriggerDbError(error.message) };

  revalidateDisposals();
  return { success: true };
}

export async function getDisposalLookupsAction() {
  const [assets, users] = await Promise.all([
    supabaseAdmin.from('assets').select('id, name, asset_tag').order('asset_tag'),
    supabaseAdmin.from('users').select('id, first_name, last_name').order('first_name'),
  ]);
  return {
    assets: (assets.data ?? []).filter((a) => a.id),
    error: assets.error?.message || users.error?.message,
  };
}
