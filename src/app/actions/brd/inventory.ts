'use server';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { requireBrdRole } from './_auth';
import { createBrdNotification } from '@/lib/brd/notify';
import { formatAuditTriggerDbError } from '@/lib/supabase/audit-db-errors';
import type { InventoryItem } from '@/lib/brd/types';

const INVENTORY_LIST_SELECT = '*, asset_categories(id, name), vendors(id, name)';

function revalidateInventory() {
  revalidatePath('/dashboard/inventory');
}

export async function listInventoryItemsAction(params: {
  search?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  const auth = await requireBrdRole(['Admin']);
  if (auth.error) {
    return { error: auth.error, data: [] as InventoryItem[], total: 0 };
  }

  const { search, page = 1, pageSize = 10 } = params;
  let query = supabaseAdmin
    .from('inventory')
    .select(INVENTORY_LIST_SELECT, { count: 'exact' });

  if (search?.trim()) {
    const term = search.trim();
    query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%`);
  }

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.order('name').range(from, from + pageSize - 1);

  const total = count ?? 0;
  console.log('[inventory-list]', {
    total,
    pageRowCount: data?.length ?? 0,
    search: search?.trim() ?? '',
  });

  if (error) {
    return {
      error: formatAuditTriggerDbError(error.message),
      data: [] as InventoryItem[],
      total: 0,
    };
  }

  return { data: (data as InventoryItem[]) ?? [], total };
}

export async function listInventoryMetricsAction() {
  const auth = await requireBrdRole(['Admin']);
  if (auth.error) {
    return { error: auth.error, data: [] as InventoryItem[] };
  }

  const { data, error, count } = await supabaseAdmin
    .from('inventory')
    .select('id, name, sku, quantity_on_hand, reorder_level, unit_cost, location, created_at, category_id, vendor_id')
    .order('name')
    .limit(500);

  console.log('[inventory-metrics]', { total: count ?? data?.length ?? 0 });

  if (error) {
    return {
      error: formatAuditTriggerDbError(error.message),
      data: [] as InventoryItem[],
    };
  }

  return { data: (data as InventoryItem[]) ?? [] };
}

export async function getInventoryItemAction(id: string) {
  const auth = await requireBrdRole(['Admin']);
  if (auth.error) {
    return { error: auth.error, data: null as InventoryItem | null };
  }

  const { data, error } = await supabaseAdmin
    .from('inventory')
    .select(INVENTORY_LIST_SELECT)
    .eq('id', id)
    .single();

  if (error) {
    return {
      error: formatAuditTriggerDbError(error.message),
      data: null as InventoryItem | null,
    };
  }

  return { data: data as InventoryItem };
}

export async function createInventoryAction(input: {
  name: string;
  sku?: string | null;
  category_id?: string | null;
  vendor_id?: string | null;
  quantity_on_hand?: number;
  reorder_level?: number;
  unit_cost?: number | null;
  location?: string | null;
  notes?: string | null;
}) {
  const auth = await requireBrdRole(['Admin', 'Manager']);
  if (auth.error) return { error: auth.error };

  if (!input.name?.trim()) return { error: 'Name is required.' };

  const qty = input.quantity_on_hand ?? 0;
  if (qty < 0) return { error: 'Quantity cannot be negative.' };

  const { data, error } = await supabaseAdmin
    .from('inventory')
    .insert([
      {
        name: input.name.trim(),
        sku: input.sku?.trim() || null,
        category_id: input.category_id || null,
        vendor_id: input.vendor_id || null,
        quantity_on_hand: qty,
        reorder_level: input.reorder_level ?? 0,
        unit_cost: input.unit_cost ?? null,
        location: input.location?.trim() || null,
        notes: input.notes?.trim() || null,
      },
    ])
    .select('id')
    .single();

  if (error) return { error: formatAuditTriggerDbError(error.message) };

  if (qty <= (input.reorder_level ?? 0)) {
    await createBrdNotification({
      title: 'Low stock alert',
      message: `Inventory item "${input.name.trim()}" is at or below reorder level.`,
    });
  }

  revalidateInventory();
  return { success: true, id: data?.id };
}

export async function updateInventoryAction(
  id: string,
  input: Partial<{
    name: string;
    sku: string | null;
    category_id: string | null;
    vendor_id: string | null;
    quantity_on_hand: number;
    reorder_level: number;
    unit_cost: number | null;
    location: string | null;
    notes: string | null;
  }>
) {
  const auth = await requireBrdRole(['Admin', 'Manager']);
  if (auth.error) return { error: auth.error };

  const { error } = await supabaseAdmin.from('inventory').update(input).eq('id', id);
  if (error) return { error: formatAuditTriggerDbError(error.message) };

  revalidateInventory();
  return { success: true };
}

export async function deleteInventoryAction(id: string) {
  const auth = await requireBrdRole(['Admin']);
  if (auth.error) return { error: auth.error };

  const { error } = await supabaseAdmin.from('inventory').delete().eq('id', id);
  if (error) return { error: formatAuditTriggerDbError(error.message) };

  revalidateInventory();
  return { success: true };
}
