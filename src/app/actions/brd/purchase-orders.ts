'use server';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { requireBrdRole } from './_auth';
import { createBrdNotification } from '@/lib/brd/notify';
import { formatAuditTriggerDbError } from '@/lib/supabase/audit-db-errors';
import { REQUEST_STATUS } from '@/lib/constants/request-status';
import { canCreatePurchaseOrder } from '@/lib/brd/request-workflow';
import type { PurchaseOrder } from '@/lib/brd/types';

function revalidatePO() {
  revalidatePath('/dashboard/purchase-orders');
  revalidatePath('/dashboard/procurement');
}

type PurchaseOrderRow = Omit<PurchaseOrder, 'vendors' | 'procurements'>;

async function enrichPurchaseOrders(rows: PurchaseOrderRow[]): Promise<PurchaseOrder[]> {
  if (rows.length === 0) return [];

  const vendorIds = [...new Set(rows.map((row) => row.vendor_id).filter(Boolean))] as string[];
  const procurementIds = [...new Set(rows.map((row) => row.procurement_id).filter(Boolean))] as string[];

  const [vendorsRes, procurementsRes] = await Promise.all([
    vendorIds.length > 0
      ? supabaseAdmin.from('vendors').select('id, name').in('id', vendorIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
    procurementIds.length > 0
      ? supabaseAdmin.from('procurements').select('id, title').in('id', procurementIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[], error: null }),
  ]);

  const vendorMap = new Map((vendorsRes.data ?? []).map((vendor) => [vendor.id, vendor]));
  const procurementMap = new Map((procurementsRes.data ?? []).map((proc) => [proc.id, proc]));

  return rows.map((row) => ({
    ...row,
    vendors: row.vendor_id ? vendorMap.get(row.vendor_id) ?? null : null,
    procurements: row.procurement_id ? procurementMap.get(row.procurement_id) ?? null : null,
  }));
}

export async function listPurchaseOrdersAction(params: {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  const auth = await requireBrdRole(['Admin']);
  if (auth.error) return { error: auth.error, data: [] as PurchaseOrder[], total: 0 };

  const { status, search, page = 1, pageSize = 10 } = params;
  let query = supabaseAdmin.from('purchase_orders').select('*', { count: 'exact' });

  if (status && status !== 'ALL') query = query.eq('status', status);
  if (search) query = query.ilike('po_number', `%${search}%`);

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) {
    return { error: formatAuditTriggerDbError(error.message), data: [] as PurchaseOrder[], total: 0 };
  }

  const enriched = await enrichPurchaseOrders((data as PurchaseOrderRow[]) ?? []);
  return { data: enriched, total: count ?? 0 };
}

export async function listPurchaseOrderMetricsAction() {
  const auth = await requireBrdRole(['Admin']);
  if (auth.error) return { error: auth.error, data: [] as PurchaseOrder[] };

  const { data, error } = await supabaseAdmin
    .from('purchase_orders')
    .select('id, status, total_amount, order_date, created_at')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    return { error: formatAuditTriggerDbError(error.message), data: [] as PurchaseOrder[] };
  }

  return { data: (data as PurchaseOrder[]) ?? [] };
}

export async function getPurchaseOrderAction(id: string) {
  const auth = await requireBrdRole(['Admin']);
  if (auth.error) return { error: auth.error, data: null as PurchaseOrder | null };

  const { data, error } = await supabaseAdmin
    .from('purchase_orders')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) return { error: formatAuditTriggerDbError(error.message), data: null };
  if (!data) return { error: 'Purchase order not found.', data: null };

  const [enriched] = await enrichPurchaseOrders([data as PurchaseOrderRow]);
  return { data: enriched ?? null };
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
  const auth = await requireBrdRole(['Admin']);
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
  const auth = await requireBrdRole(['Admin']);
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
