'use server';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { requireBrdRole } from './_auth';
import { createBrdNotification } from '@/lib/brd/notify';
import { formatAuditTriggerDbError } from '@/lib/supabase/audit-db-errors';
import { canStartProcurement } from '@/lib/brd/request-workflow';

function revalidateProcurement() {
  revalidatePath('/dashboard/procurement');
}

export async function createProcurementAction(input: {
  title: string;
  description?: string | null;
  request_id?: string | null;
  vendor_id?: string | null;
  priority?: string;
  estimated_cost?: number | null;
  notes?: string | null;
}) {
  const auth = await requireBrdRole(['Admin', 'Manager', 'Procurement']);
  if (auth.error) return { error: auth.error };

  if (!input.title?.trim()) return { error: 'Title is required.' };

  if (input.request_id) {
    const { data: linkedRequest, error: reqErr } = await supabaseAdmin
      .from('asset_requests')
      .select('status')
      .eq('id', input.request_id)
      .single();
    if (reqErr || !linkedRequest) {
      return { error: 'Linked asset request was not found.' };
    }
    if (!canStartProcurement(linkedRequest.status)) {
      return {
        error:
          'Procurement can only be linked after finance approval. Request must be in Approved status.',
      };
    }
  }

  const { data, error } = await supabaseAdmin
    .from('procurements')
    .insert([
      {
        title: input.title.trim(),
        description: input.description?.trim() || null,
        request_id: input.request_id || null,
        vendor_id: input.vendor_id || null,
        priority: input.priority ?? 'Medium',
        estimated_cost: input.estimated_cost ?? null,
        notes: input.notes?.trim() || null,
        requester_id: auth.profile?.id ?? null,
        status: 'Draft',
      },
    ])
    .select('id')
    .single();

  if (error) return { error: formatAuditTriggerDbError(error.message) };

  await createBrdNotification({
    title: 'Procurement created',
    message: `New procurement case: ${input.title.trim()}`,
  });

  revalidateProcurement();
  return { success: true, id: data?.id };
}

export async function updateProcurementAction(
  id: string,
  input: Partial<{
    title: string;
    description: string | null;
    status: string;
    vendor_id: string | null;
    priority: string;
    estimated_cost: number | null;
    notes: string | null;
  }>
) {
  const auth = await requireBrdRole(['Admin', 'Manager', 'Procurement']);
  if (auth.error) return { error: auth.error };

  const { error } = await supabaseAdmin.from('procurements').update(input).eq('id', id);
  if (error) return { error: formatAuditTriggerDbError(error.message) };

  if (input.status) {
    await createBrdNotification({
      title: 'Procurement updated',
      message: `Procurement status changed to ${input.status}.`,
    });
  }

  revalidateProcurement();
  return { success: true };
}

export async function deleteProcurementAction(id: string) {
  const auth = await requireBrdRole(['Admin']);
  if (auth.error) return { error: auth.error };

  const { error } = await supabaseAdmin.from('procurements').delete().eq('id', id);
  if (error) return { error: formatAuditTriggerDbError(error.message) };

  revalidateProcurement();
  return { success: true };
}
