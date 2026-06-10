'use server';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { requireBrdRole } from './_auth';
import { createBrdNotification } from '@/lib/brd/notify';
import { formatAuditTriggerDbError } from '@/lib/supabase/audit-db-errors';
import { REQUEST_STATUS } from '@/lib/constants/request-status';
import { canCreatePurchaseOrder } from '@/lib/brd/request-workflow';

function revalidatePO() {
  revalidatePath('/dashboard/purchase-orders');
  revalidatePath('/dashboard/procurement');
}

export async function createPurchaseOrderAction(input: {
  po_number: string;
  procurement_id?: string | null;
  vendor_id?: string | null;
  total_amount?: number | null;
  order_date?: string | null;
  expected_delivery?: string | null;
  notes?: string | null;
}) {
  const auth = await requireBrdRole(['Admin', 'Manager']);
  if (auth.error) return { error: auth.error };

  if (!input.po_number?.trim()) return { error: 'PO number is required.' };

  const { data, error } = await supabaseAdmin
    .from('purchase_orders')
    .insert([
      {
        po_number: input.po_number.trim(),
        procurement_id: input.procurement_id || null,
        vendor_id: input.vendor_id || null,
        total_amount: input.total_amount ?? null,
        order_date: input.order_date || null,
        expected_delivery: input.expected_delivery || null,
        notes: input.notes?.trim() || null,
        status: 'Draft',
      },
    ])
    .select('id')
    .single();

  if (error) return { error: formatAuditTriggerDbError(error.message) };

  if (input.procurement_id) {
    const { data: procurement } = await supabaseAdmin
      .from('procurements')
      .select('request_id')
      .eq('id', input.procurement_id)
      .single();

    if (procurement?.request_id) {
      const { data: linkedRequest } = await supabaseAdmin
        .from('asset_requests')
        .select('status')
        .eq('id', procurement.request_id)
        .single();

      if (!linkedRequest || !canCreatePurchaseOrder(linkedRequest.status)) {
        return {
          error:
            'Purchase orders require finance-approved requests. Complete finance approval before purchasing.',
        };
      }

      await supabaseAdmin
        .from('asset_requests')
        .update({ status: REQUEST_STATUS.PURCHASING })
        .eq('id', procurement.request_id);
    }

    await supabaseAdmin
      .from('procurements')
      .update({ status: 'Ordered' })
      .eq('id', input.procurement_id);
  }

  await createBrdNotification({
    title: 'Purchase order created',
    message: `PO ${input.po_number.trim()} has been created.`,
  });

  revalidatePO();
  return { success: true, id: data?.id };
}

export async function updatePurchaseOrderAction(
  id: string,
  input: Partial<{
    po_number: string;
    status: string;
    vendor_id: string | null;
    total_amount: number | null;
    order_date: string | null;
    expected_delivery: string | null;
    notes: string | null;
  }>
) {
  const auth = await requireBrdRole(['Admin', 'Manager']);
  if (auth.error) return { error: auth.error };

  const { error } = await supabaseAdmin.from('purchase_orders').update(input).eq('id', id);
  if (error) return { error: formatAuditTriggerDbError(error.message) };

  if (input.status === 'Received') {
    const { data: po } = await supabaseAdmin
      .from('purchase_orders')
      .select('procurement_id')
      .eq('id', id)
      .single();

    if (po?.procurement_id) {
      const { data: procurement } = await supabaseAdmin
        .from('procurements')
        .select('request_id')
        .eq('id', po.procurement_id)
        .single();

      if (procurement?.request_id) {
        await supabaseAdmin
          .from('asset_requests')
          .update({ status: REQUEST_STATUS.RECEIVED })
          .eq('id', procurement.request_id);
      }
    }

    await createBrdNotification({
      title: 'PO received',
      message: 'A purchase order has been marked as received. Asset registration may proceed.',
    });
  }

  revalidatePO();
  return { success: true };
}

export async function deletePurchaseOrderAction(id: string) {
  const auth = await requireBrdRole(['Admin']);
  if (auth.error) return { error: auth.error };

  const { error } = await supabaseAdmin.from('purchase_orders').delete().eq('id', id);
  if (error) return { error: formatAuditTriggerDbError(error.message) };

  revalidatePO();
  return { success: true };
}
