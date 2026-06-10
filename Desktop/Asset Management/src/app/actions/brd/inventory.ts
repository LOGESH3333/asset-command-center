'use server';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { requireBrdRole } from './_auth';
import { createBrdNotification } from '@/lib/brd/notify';
import { formatAuditTriggerDbError } from '@/lib/supabase/audit-db-errors';

function revalidateInventory() {
  revalidatePath('/dashboard/inventory');
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
