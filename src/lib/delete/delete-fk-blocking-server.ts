import 'server-only';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { resolveDeleteBlockingInfo, type DeleteBlockingInfo } from '@/lib/delete/delete-fk-blocking';

export async function countReferencingRows(
  table: string,
  column: string,
  value: string
): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq(column, value);

  if (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[DELETE] Dependency count skipped for ${table}.${column}`, error.message);
    }
    return 0;
  }

  return count ?? 0;
}

async function findFirstBlockingReference(
  checks: Array<{ table: string; column: string }>,
  value: string
): Promise<DeleteBlockingInfo | null> {
  for (const check of checks) {
    const referencedRows = await countReferencingRows(check.table, check.column, value);
    if (referencedRows > 0) {
      return resolveDeleteBlockingInfo(check.table, check.column, referencedRows);
    }
  }
  return null;
}

export async function checkAssetDeleteBlocking(assetId: string): Promise<DeleteBlockingInfo | null> {
  return findFirstBlockingReference(
    [
      { table: 'maintenance_records', column: 'asset_id' },
      { table: 'asset_allocations', column: 'asset_id' },
      { table: 'asset_disposals', column: 'asset_id' },
    ],
    assetId
  );
}

export async function checkCategoryDeleteBlocking(categoryId: string): Promise<DeleteBlockingInfo | null> {
  return findFirstBlockingReference(
    [
      { table: 'asset_requests', column: 'category_id' },
      { table: 'assets', column: 'category_id' },
      { table: 'inventory', column: 'category_id' },
    ],
    categoryId
  );
}

export async function checkVendorDeleteBlocking(vendorId: string): Promise<DeleteBlockingInfo | null> {
  return findFirstBlockingReference(
    [
      { table: 'assets', column: 'vendor_id' },
      { table: 'maintenance_records', column: 'vendor_id' },
      { table: 'procurements', column: 'vendor_id' },
    ],
    vendorId
  );
}

export async function checkUserDeleteBlocking(userId: string): Promise<DeleteBlockingInfo | null> {
  return findFirstBlockingReference([{ table: 'asset_requests', column: 'requester_id' }], userId);
}
