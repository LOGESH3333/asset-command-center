'use server';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { insertAssetRequestRow, updateAssetRequestRow } from '@/lib/supabase/asset-request-insert';
import type { AssetRequestInsert, AssetRequestUpdate } from '@/lib/supabase/requests';
import { revalidatePath } from 'next/cache';
import type { Asset } from '@/lib/supabase/assets';
import { getSessionUser } from '@/lib/auth/session';
import { DEFAULT_REQUEST_STATUS } from '@/lib/constants/request-status';
import { ensureAssetQrMetadata } from '@/lib/assets/ensure-asset-qr';
import {
  findAssetByRequestId,
  findAssetByTag,
  isAssetTagTaken,
  nameFromRequestJustification,
  prepareAssetCreatePayload,
  suggestNextAssetTag,
  validateAssetCreateInput,
} from '@/lib/assets/asset-registration';
import { createAssetAllocationRow } from '@/lib/brd/allocation-create';
import { resolveSerialNumber } from '@/lib/assets/qr-code';
import { formatUserFacingDbError } from '@/lib/supabase/audit-db-errors';
import { insertAssetRow, updateAssetRow } from '@/lib/supabase/assets-schema';
import { isSuperAdmin, type AppRole } from '@/lib/auth/roles';

function mapDbError(message: string) {
  return formatUserFacingDbError(message);
}

export type FormOptions = {
  categories: { id: string; name: string }[];
  vendors: { id: string; name: string }[];
  users: { id: string; first_name: string; last_name: string; department: string | null }[];
  assets: { id: string; name: string; asset_tag: string }[];
  requests: { id: string; justification: string; status: string; requester_id: string | null }[];
};

function revalidateCore() {
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/assets');
  revalidatePath('/dashboard/reports');
  revalidatePath('/dashboard/audit-logs');
}

async function requireRole(allowed: AppRole[]) {
  const { profile } = await getSessionUser();
  if (!profile || (!isSuperAdmin(profile.role) && !allowed.includes(profile.role))) {
    return { error: 'You do not have permission to perform this action.', profile: null };
  }
  return { profile, error: undefined };
}

export async function getFormOptionsAction(): Promise<{ data?: FormOptions; error?: string }> {
  try {
    const auth = await requireRole(['Admin', 'Manager', 'Employee']);
    if (auth.error) return { error: auth.error };

    const canLinkRequests =
      auth.profile?.role === 'Admin' ||
      auth.profile?.role === 'Manager' ||
      isSuperAdmin(auth.profile?.role);

    const { fetchVendorOptions } = await import('@/lib/supabase/vendor-lookups-server');

    const [cats, vendorResult, users, assets, requests] = await Promise.all([
      supabaseAdmin.from('asset_categories').select('id, name').order('name'),
      fetchVendorOptions(),
      supabaseAdmin.from('users').select('id, first_name, last_name, department').order('first_name'),
      supabaseAdmin.from('assets').select('id, name, asset_tag').order('asset_tag'),
      canLinkRequests
        ? supabaseAdmin
            .from('asset_requests')
            .select('id, justification, status, requester_id')
            .in('status', ['Approved', 'Purchasing', 'Received'])
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

    return {
      data: {
        categories: cats.error ? [] : (cats.data ?? []),
        vendors: vendorResult.error ? [] : vendorResult.data,
        users: users.error ? [] : (users.data ?? []),
        assets: assets.error ? [] : (assets.data ?? []).filter((a) => a.id),
        requests: requests.error ? [] : (requests.data ?? []),
      },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to load form options' };
  }
}

export async function getMaintenanceLookupsAction(): Promise<{
  data?: { assets: FormOptions['assets']; vendors: FormOptions['vendors'] };
  warnings?: string[];
  error?: string;
}> {
  try {
    const auth = await requireRole(['Admin', 'Manager']);
    if (auth.error) return { error: auth.error };

    const { fetchMaintenanceLookups } = await import('@/lib/supabase/maintenance-db');
    const result = await fetchMaintenanceLookups();
    if (result.error) return { error: result.error, warnings: result.warnings };
    return {
      data: { assets: result.assets, vendors: result.vendors },
      warnings: result.warnings.length ? result.warnings : undefined,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to load maintenance lookups' };
  }
}

export type CreateAssetInput = Omit<Asset, 'id' | 'created_at' | 'updated_at'>;

function serializeRegistrationError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  if (typeof error === 'object' && error !== null) {
    return error;
  }
  return { message: String(error) };
}

function logAssetRegistrationStep(
  step: string,
  payload: Record<string, unknown> = {}
) {
  if (step.endsWith(':error')) {
    console.error(`[asset-registration] ${step}`, payload);
    return;
  }
  console.log(`[asset-registration] ${step}`, payload);
}

async function ensureRegistrationAllocation(asset: Asset, userId: string) {
  logAssetRegistrationStep('allocation:start', {
    asset_id: asset.id,
    asset_tag: asset.asset_tag,
    user_id: userId,
  });

  const result = await createAssetAllocationRow({
    asset_id: asset.id,
    user_id: userId,
    notes: `Allocated during registration (${asset.asset_tag})`,
  });

  if (result.error) {
    logAssetRegistrationStep('allocation:error', {
      asset_id: asset.id,
      asset_tag: asset.asset_tag,
      user_id: userId,
      error: result.error,
    });
    throw new Error(`allocation creation failed: ${result.error}`);
  }
  if (!result.data) {
    logAssetRegistrationStep('allocation:error', {
      asset_id: asset.id,
      asset_tag: asset.asset_tag,
      user_id: userId,
      error: 'Allocation returned no data.',
    });
    throw new Error('allocation creation failed: Allocation returned no data.');
  }

  logAssetRegistrationStep('allocation:success', {
    allocation_id: result.data.id,
    asset_id: asset.id,
    asset_tag: asset.asset_tag,
    user_id: userId,
  });
}

async function finalizeAssetRegistration(
  asset: Asset,
  assignedEmployeeId: string | null
): Promise<Asset> {
  const data = { ...asset };

  if (data.id) {
    try {
      logAssetRegistrationStep('qr:start', {
        asset_id: data.id,
        asset_tag: data.asset_tag,
      });
      const qrMeta = await ensureAssetQrMetadata({
        id: data.id,
        name: data.name,
        asset_tag: data.asset_tag,
        serial_number: data.serial_number,
        qr_payload: data.qr_payload,
      });
      data.serial_number = qrMeta.serial_number;
      data.qr_payload = qrMeta.qr_payload;
      data.qr_generated_at = qrMeta.qr_generated_at;
      logAssetRegistrationStep('qr:success', {
        asset_id: data.id,
        asset_tag: data.asset_tag,
        qr_generated_at: qrMeta.qr_generated_at,
      });
    } catch (error) {
      logAssetRegistrationStep('qr:error', {
        asset_id: data.id,
        asset_tag: data.asset_tag,
        error: serializeRegistrationError(error),
      });
      throw error;
    }
  }

  if (assignedEmployeeId && data.id) {
    await ensureRegistrationAllocation(data, assignedEmployeeId);
  }

  return data;
}

export async function getAssetRegistrationDefaultsAction(requestId?: string | null) {
  try {
    const auth = await requireRole(['Admin', 'Manager']);
    if (auth.error) return { error: auth.error };

    const suggested_asset_tag = await suggestNextAssetTag();
    let suggested_name = '';
    let existing_asset_tag: string | null = null;
    let existing_asset_id: string | null = null;

    if (requestId) {
      const [{ data: requestRow }, existingAsset] = await Promise.all([
        supabaseAdmin
          .from('asset_requests')
          .select('justification, status')
          .eq('id', requestId)
          .maybeSingle(),
        findAssetByRequestId(requestId),
      ]);

      if (requestRow?.justification) {
        suggested_name = nameFromRequestJustification(requestRow.justification);
      }
      if (existingAsset) {
        existing_asset_tag = existingAsset.asset_tag;
        existing_asset_id = existingAsset.id;
      }
    }

    return {
      data: {
        suggested_asset_tag,
        suggested_name,
        existing_asset_tag,
        existing_asset_id,
      },
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to load registration defaults',
    };
  }
}

export async function checkAssetTagAction(assetTag: string) {
  try {
    const auth = await requireRole(['Admin', 'Manager']);
    if (auth.error) return { error: auth.error };

    const normalized = assetTag.trim().toUpperCase();
    if (!normalized) return { data: { available: false, message: 'Asset tag is required.' } };

    const taken = await isAssetTagTaken(normalized);
    if (taken) {
      const nextTag = await suggestNextAssetTag();
      return {
        data: {
          available: false,
          message: `Tag "${normalized}" is already registered. Try "${nextTag}".`,
          suggested_asset_tag: nextTag,
        },
      };
    }

    return { data: { available: true, normalized_tag: normalized } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to check asset tag' };
  }
}

export async function createAssetAction(input: CreateAssetInput) {
  let lastStep = 'not-started';
  try {
    lastStep = 'action:start';
    logAssetRegistrationStep('action:start', {
      asset_tag: input.asset_tag,
      request_id: input.request_id ?? null,
      assigned_employee_id: input.assigned_employee_id ?? null,
      vendor_id: input.vendor_id ?? null,
      status: input.status,
    });

    lastStep = 'auth';
    const auth = await requireRole(['Admin', 'Manager']);
    if (auth.error) {
      logAssetRegistrationStep('auth:error', { error: auth.error });
      return { error: auth.error };
    }
    logAssetRegistrationStep('auth:success', {
      profile_id: auth.profile?.id ?? null,
      role: auth.profile?.role ?? null,
    });

    lastStep = 'validation';
    logAssetRegistrationStep('validation:start', {
      asset_tag: input.asset_tag,
      request_id: input.request_id ?? null,
      category_id: input.category_id ?? null,
      vendor_id: input.vendor_id ?? null,
      assigned_employee_id: input.assigned_employee_id ?? null,
    });
    const validationError = await validateAssetCreateInput(input);
    if (validationError) {
      logAssetRegistrationStep('validation:error', { error: validationError });
      return { error: validationError };
    }
    logAssetRegistrationStep('validation:success');

    lastStep = 'prepare';
    logAssetRegistrationStep('prepare:start');
    const prepared = await prepareAssetCreatePayload(input);
    logAssetRegistrationStep('prepare:success', {
      asset_tag: prepared.asset_tag,
      request_id: prepared.request_id ?? null,
      assigned_employee_id: prepared.assigned_employee_id ?? null,
      status: prepared.status,
      serial_number: prepared.serial_number,
    });

    const insertPayload = {
      ...prepared,
      status: prepared.status === 'Allocated' ? 'Available' : prepared.status,
      assigned_employee_id:
        prepared.status === 'Allocated' ? null : prepared.assigned_employee_id,
    };
    logAssetRegistrationStep('insert-payload:prepared', {
      asset_tag: insertPayload.asset_tag,
      request_id: insertPayload.request_id ?? null,
      assigned_employee_id: insertPayload.assigned_employee_id ?? null,
      status: insertPayload.status,
      vendor_id: insertPayload.vendor_id ?? null,
    });

    lastStep = 'existing-request-check';
    logAssetRegistrationStep('existing-request-check:start', {
      request_id: prepared.request_id ?? null,
    });
    const existingByRequest = prepared.request_id
      ? await findAssetByRequestId(prepared.request_id)
      : null;
    logAssetRegistrationStep('existing-request-check:success', {
      found: Boolean(existingByRequest),
      existing_asset_id: existingByRequest?.id ?? null,
      existing_asset_tag: existingByRequest?.asset_tag ?? null,
    });

    if (existingByRequest) {
      lastStep = 'finalize-existing-request';
      logAssetRegistrationStep('finalize-existing-request:start', {
        asset_id: existingByRequest.id,
        asset_tag: existingByRequest.asset_tag,
      });
      const data = await finalizeAssetRegistration(
        existingByRequest,
        prepared.assigned_employee_id
      );
      logAssetRegistrationStep('finalize-existing-request:success', {
        asset_id: data.id,
        asset_tag: data.asset_tag,
      });

      lastStep = 'revalidate-existing-request';
      logAssetRegistrationStep('revalidate:start', { pathGroup: 'core' });
      revalidateCore();
      logAssetRegistrationStep('revalidate:success', { pathGroup: 'core' });
      return {
        data,
        resumed: true,
        message: `Asset ${existingByRequest.asset_tag} was already registered for this request. Registration completed.`,
      };
    }

    lastStep = 'existing-tag-check';
    logAssetRegistrationStep('existing-tag-check:start', {
      asset_tag: prepared.asset_tag,
    });
    const existingByTag = await findAssetByTag(prepared.asset_tag);
    logAssetRegistrationStep('existing-tag-check:success', {
      found: Boolean(existingByTag),
      existing_asset_id: existingByTag?.id ?? null,
      existing_asset_tag: existingByTag?.asset_tag ?? null,
    });

    if (existingByTag) {
      const sameRequest =
        prepared.request_id &&
        (existingByTag.request_id === prepared.request_id || !existingByTag.request_id);
      const incompleteRegistration = !existingByTag.qr_payload;

      if (sameRequest || incompleteRegistration) {
        const patch: Record<string, unknown> = {};
        if (prepared.request_id && !existingByTag.request_id) {
          patch.request_id = prepared.request_id;
        }
        if (Object.keys(patch).length > 0) {
          lastStep = 'existing-tag-link';
          logAssetRegistrationStep('existing-tag-link:start', {
            asset_id: existingByTag.id,
            patch,
          });
          const { error: linkError } = await updateAssetRow('id', existingByTag.id, patch);
          if (linkError) {
            logAssetRegistrationStep('existing-tag-link:error', { error: linkError });
            return { error: linkError.message };
          }
          logAssetRegistrationStep('existing-tag-link:success', {
            asset_id: existingByTag.id,
          });
        }

        const merged = { ...existingByTag, ...prepared, id: existingByTag.id };
        lastStep = 'finalize-existing-tag';
        logAssetRegistrationStep('finalize-existing-tag:start', {
          asset_id: merged.id,
          asset_tag: merged.asset_tag,
        });
        const data = await finalizeAssetRegistration(merged, prepared.assigned_employee_id);
        logAssetRegistrationStep('finalize-existing-tag:success', {
          asset_id: data.id,
          asset_tag: data.asset_tag,
        });

        lastStep = 'revalidate-existing-tag';
        logAssetRegistrationStep('revalidate:start', { pathGroup: 'core' });
        revalidateCore();
        logAssetRegistrationStep('revalidate:success', { pathGroup: 'core' });
        return {
          data,
          resumed: true,
          message: incompleteRegistration
            ? `Asset ${existingByTag.asset_tag} was partially registered — registration completed.`
            : `Asset ${existingByTag.asset_tag} already exists — linked to this request and finalized.`,
        };
      }

      const nextTag = await suggestNextAssetTag();
      return {
        error: `Asset tag "${prepared.asset_tag}" is already registered. Use "${nextTag}" or another unique tag.`,
      };
    }

    lastStep = 'asset-insert';
    logAssetRegistrationStep('asset-insert:start', {
      asset_tag: insertPayload.asset_tag,
      request_id: insertPayload.request_id ?? null,
      vendor_id: insertPayload.vendor_id ?? null,
      assigned_employee_id: insertPayload.assigned_employee_id ?? null,
      status: insertPayload.status,
    });
    const { data: inserted, error } = await insertAssetRow({
      ...insertPayload,
    } as Record<string, unknown>);
    if (error) {
      logAssetRegistrationStep('asset-insert:error', { error });
      return { error: error.message };
    }

    const insertedAsset = inserted as Asset;
    logAssetRegistrationStep('asset-insert:success', {
      asset_id: insertedAsset.id,
      asset_tag: insertedAsset.asset_tag,
      status: insertedAsset.status,
      assigned_employee_id: insertedAsset.assigned_employee_id ?? null,
    });

    lastStep = 'finalize-new-asset';
    logAssetRegistrationStep('finalize-new-asset:start', {
      asset_id: insertedAsset.id,
      asset_tag: insertedAsset.asset_tag,
      assigned_employee_id: prepared.assigned_employee_id ?? null,
    });
    const data = await finalizeAssetRegistration(insertedAsset, prepared.assigned_employee_id);
    logAssetRegistrationStep('finalize-new-asset:success', {
      asset_id: data.id,
      asset_tag: data.asset_tag,
      status: data.status,
    });

    lastStep = 'revalidate-new-asset';
    logAssetRegistrationStep('revalidate:start', { pathGroup: 'core' });
    revalidateCore();
    logAssetRegistrationStep('revalidate:success', { pathGroup: 'core' });
    logAssetRegistrationStep('action:success', {
      asset_id: data.id,
      asset_tag: data.asset_tag,
    });
    return { data };
  } catch (err) {
    const serialized = serializeRegistrationError(err);
    console.error('[asset-registration] action:unhandled-error', {
      lastStep,
      error: serialized,
    });
    return {
      error:
        err instanceof Error
          ? `[asset-registration:${lastStep}] ${err.message}\n${err.stack ?? ''}`
          : `[asset-registration:${lastStep}] ${JSON.stringify(err, null, 2)}`,
    };
  }
}

export async function updateAssetAction(
  assetTag: string,
  input: Partial<CreateAssetInput>
) {
  try {
    const auth = await requireRole(['Admin', 'Manager']);
    if (auth.error) return { error: auth.error };

    const { data: existing } = await supabaseAdmin
      .from('assets')
      .select('id, assigned_employee_id, name, asset_tag, serial_number, status')
      .eq('asset_tag', assetTag)
      .single();

    const updates = { ...input };
    const requestedAllocationUserId =
      input.assigned_employee_id ?? existing?.assigned_employee_id ?? null;
    const shouldAllocateViaTransaction =
      Boolean(existing?.id && input.assigned_employee_id && input.assigned_employee_id !== existing.assigned_employee_id) ||
      Boolean(existing?.id && input.status === 'Allocated');

    if (input.status === 'Allocated' && !requestedAllocationUserId) {
      return { error: 'Select an employee before marking an asset as Allocated.' };
    }

    if (shouldAllocateViaTransaction) {
      delete updates.status;
      delete updates.assigned_employee_id;
    }

    if (input.serial_number !== undefined) {
      updates.serial_number = resolveSerialNumber({
        asset_tag: assetTag,
        serial_number: input.serial_number,
      });
    }

    const { error } = await updateAssetRow('asset_tag', assetTag, updates as Record<string, unknown>);
    if (error) return { error: mapDbError(error.message) };

    if (existing?.id) {
      const shouldRefreshQr =
        input.name !== undefined || input.serial_number !== undefined;

      if (shouldRefreshQr) {
        const { data: refreshed } = await supabaseAdmin
          .from('assets')
          .select('id, name, asset_tag, serial_number')
          .eq('id', existing.id)
          .single();

        if (refreshed) {
          try {
            await ensureAssetQrMetadata(refreshed);
          } catch (qrErr) {
            return {
              error: qrErr instanceof Error ? qrErr.message : 'Asset updated but QR refresh failed',
            };
          }
        }
      }
    }
    if (shouldAllocateViaTransaction && existing?.id && requestedAllocationUserId) {
      const allocation = await createAssetAllocationRow({
        asset_id: existing.id,
        user_id: requestedAllocationUserId,
        notes: `Allocated via asset edit (${assetTag})`,
      });
      if (allocation.error) return { error: allocation.error };
    }
    revalidateCore();
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update asset' };
  }
}

export async function deleteAssetAction(assetTag: string) {
  try {
    const auth = await requireRole(['Admin']);
    if (auth.error) return { error: auth.error };

    const { data: asset } = await supabaseAdmin
      .from('assets')
      .select('id')
      .eq('asset_tag', assetTag)
      .maybeSingle();

    if (!asset?.id) return { error: 'Asset not found.' };

    const { checkAssetDeleteBlocking } = await import('@/lib/delete/delete-fk-blocking-server');
    const { toBlockedDeleteResponse, handleDeleteDbError } = await import('@/lib/delete/delete-fk-blocking');

    const precheck = await checkAssetDeleteBlocking(asset.id);
    if (precheck) return toBlockedDeleteResponse(precheck, 'asset', { assetTag });

    const { error } = await supabaseAdmin.from('assets').delete().eq('asset_tag', assetTag);
    if (error) {
      const handled = handleDeleteDbError(error, 'asset', { assetTag });
      if ('blocked' in handled) return handled;
      return { error: mapDbError(handled.error) };
    }
    revalidateCore();
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete asset' };
  }
}

export async function createCategoryAction(name: string) {
  try {
    const auth = await requireRole(['Admin']);
    if (auth.error) return { error: auth.error };

    const { error } = await supabaseAdmin.from('asset_categories').insert([{ name: name.trim() }]);
    if (error) return { error: mapDbError(error.message) };
    revalidatePath('/dashboard/categories');
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create category' };
  }
}

export async function updateCategoryAction(id: string, name: string) {
  try {
    const auth = await requireRole(['Admin']);
    if (auth.error) return { error: auth.error };

    const { error } = await supabaseAdmin.from('asset_categories').update({ name: name.trim() }).eq('id', id);
    if (error) return { error: mapDbError(error.message) };
    revalidatePath('/dashboard/categories');
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update category' };
  }
}

export async function deleteCategoryAction(id: string) {
  try {
    const auth = await requireRole(['Admin']);
    if (auth.error) return { error: auth.error };

    const { checkCategoryDeleteBlocking } = await import('@/lib/delete/delete-fk-blocking-server');
    const { toBlockedDeleteResponse, handleDeleteDbError } = await import('@/lib/delete/delete-fk-blocking');

    const precheck = await checkCategoryDeleteBlocking(id);
    if (precheck) return toBlockedDeleteResponse(precheck, 'category', { id });

    const { error } = await supabaseAdmin.from('asset_categories').delete().eq('id', id);
    if (error) {
      const handled = handleDeleteDbError(error, 'category', { id });
      if ('blocked' in handled) return handled;
      return { error: mapDbError(handled.error) };
    }
    revalidatePath('/dashboard/categories');
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete category' };
  }
}

export async function createVendorAction(vendor: {
  name: string;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}) {
  try {
    const auth = await requireRole(['Admin']);
    if (auth.error) return { error: auth.error };

    const { insertVendorRow } = await import('@/lib/supabase/vendor-db');
    const { error } = await insertVendorRow(vendor);
    if (error) return { error: mapDbError(error.message) };
    revalidatePath('/dashboard/vendors');
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create vendor' };
  }
}

export async function updateVendorAction(
  id: string,
  vendor: {
    name?: string;
    contact_person?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  }
) {
  try {
    const auth = await requireRole(['Admin']);
    if (auth.error) return { error: auth.error };

    const { updateVendorRow } = await import('@/lib/supabase/vendor-db');
    const { error } = await updateVendorRow(id, vendor);
    if (error) return { error: mapDbError(error.message) };
    revalidatePath('/dashboard/vendors');
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update vendor' };
  }
}

export async function deleteVendorAction(id: string) {
  try {
    const auth = await requireRole(['Admin']);
    if (auth.error) return { error: auth.error };

    const { checkVendorDeleteBlocking } = await import('@/lib/delete/delete-fk-blocking-server');
    const { toBlockedDeleteResponse, handleDeleteDbError } = await import('@/lib/delete/delete-fk-blocking');

    const precheck = await checkVendorDeleteBlocking(id);
    if (precheck) return toBlockedDeleteResponse(precheck, 'vendor', { id });

    const { error } = await supabaseAdmin.from('vendors').delete().eq('id', id);
    if (error) {
      const handled = handleDeleteDbError(error, 'vendor', { id });
      if ('blocked' in handled) return handled;
      return { error: mapDbError(handled.error) };
    }
    revalidatePath('/dashboard/vendors');
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete vendor' };
  }
}

export async function createRequestAction(request: AssetRequestInsert) {
  try {
    const auth = await requireRole(['Admin', 'Manager', 'Employee']);
    if (auth.error) return { error: auth.error };

    if (!request.justification?.trim()) {
      return { error: 'Justification is required.' };
    }

    const { profile } = await getSessionUser();
    const requesterId = profile?.id ?? null;

    if (!requesterId) {
      return { error: 'Unable to resolve a valid requester. Seed or create a user record first.' };
    }

    const { data, error } = await insertAssetRequestRow({
      justification: request.justification,
      status: request.status ?? DEFAULT_REQUEST_STATUS,
      priority: request.priority ?? 'Medium',
      requester_id: requesterId,
      category_id: request.category_id ?? null,
    });

    if (error) return { error: mapDbError(error.message) };

    if (data?.id) {
      const { bootstrapRequestWorkflow } = await import('@/app/actions/brd/approvals');
      const boot = await bootstrapRequestWorkflow(data.id);
      if (boot.error) return { error: boot.error };
    }

    revalidatePath('/dashboard/requests');
    revalidatePath('/dashboard/approvals');
    revalidatePath('/dashboard');
    return { success: true, id: data?.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create request' };
  }
}

export async function updateRequestAction(id: string, updates: AssetRequestUpdate) {
  try {
    if (updates.status !== undefined) {
      const { profile } = await getSessionUser();
      if (!profile || (!isSuperAdmin(profile.role) && profile.role !== 'Admin')) {
        return {
          error:
            'Request status is managed by the approval workflow. Approve or reject via the Approvals module.',
        };
      }
    }

    const { error } = await updateAssetRequestRow(id, updates);
    if (error) return { error: mapDbError(error.message) };
    revalidatePath('/dashboard/requests');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update request' };
  }
}

export async function deleteRequestAction(id: string) {
  try {
    const auth = await requireRole(['Admin']);
    if (auth.error) return { error: auth.error };

    const { error } = await supabaseAdmin.from('asset_requests').delete().eq('id', id);
    if (error) {
      const { handleDeleteDbError } = await import('@/lib/delete/delete-fk-blocking');
      const handled = handleDeleteDbError(error, 'request', { id });
      if ('blocked' in handled) return handled;
      return { error: mapDbError(handled.error) };
    }
    revalidatePath('/dashboard/requests');
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete request' };
  }
}

export async function createMaintenanceAction(record: {
  asset_id: string;
  type: string;
  description: string;
  cost?: number | null;
  vendor_id?: string | null;
  scheduled_date?: string | null;
  completed_date?: string | null;
  performed_by?: string | null;
  notes?: string | null;
}) {
  try {
    const auth = await requireRole(['Admin', 'Manager']);
    if (auth.error) return { error: auth.error };

    const { insertMaintenanceRecord } = await import('@/lib/supabase/maintenance-db');
    const { data, error } = await insertMaintenanceRecord(record);
    if (error) return { error: mapDbError(error.message) };
    revalidatePath('/dashboard/maintenance');
    revalidatePath('/dashboard');
    return { success: true, id: data?.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create maintenance record' };
  }
}

export async function updateMaintenanceAction(
  id: string,
  record: Partial<{
    asset_id: string;
    type: string;
    description: string;
    cost: number | null;
    vendor_id: string | null;
    scheduled_date: string | null;
    completed_date: string | null;
    performed_by: string | null;
    notes: string | null;
  }>
) {
  try {
    const auth = await requireRole(['Admin']);
    if (auth.error) return { error: auth.error };

    const { updateMaintenanceRecordRow } = await import('@/lib/supabase/maintenance-db');
    const { error } = await updateMaintenanceRecordRow(id, record);
    if (error) return { error: mapDbError(error.message) };
    revalidatePath('/dashboard/maintenance');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update maintenance record' };
  }
}

export async function deleteMaintenanceAction(id: string) {
  try {
    const auth = await requireRole(['Admin']);
    if (auth.error) return { error: auth.error };

    const { error } = await supabaseAdmin.from('maintenance_records').delete().eq('id', id);
    if (error) {
      const { handleDeleteDbError } = await import('@/lib/delete/delete-fk-blocking');
      const handled = handleDeleteDbError(error, 'maintenance', { id });
      if ('blocked' in handled) return handled;
      return { error: mapDbError(handled.error) };
    }
    revalidatePath('/dashboard/maintenance');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete maintenance record' };
  }
}
