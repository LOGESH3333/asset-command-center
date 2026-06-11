'use server';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/auth/session';

export async function getActivityStreamAction() {
  const { profile } = await getSessionUser();
  if (!profile) {
    return { error: 'You must be signed in to view activity.' };
  }

  try {
    const [
      auditRes,
      assetsRes,
      maintCompletedRes,
      maintScheduledRes,
      vendRes,
      fulfilledReqRes,
      recentReqRes,
      approvalRes,
      notifRes,
      allocRes,
    ] = await Promise.all([
      supabaseAdmin.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(8),
      supabaseAdmin
        .from('assets')
        .select('asset_tag, name, created_at, status, updated_at')
        .order('created_at', { ascending: false })
        .limit(4),
      supabaseAdmin
        .from('maintenance_records')
        .select('id, description, completed_date, created_at')
        .not('completed_date', 'is', null)
        .order('completed_date', { ascending: false })
        .limit(4),
      supabaseAdmin
        .from('maintenance_records')
        .select('id, description, type, scheduled_date, created_at')
        .order('created_at', { ascending: false })
        .limit(4),
      supabaseAdmin.from('vendors').select('name, created_at').order('created_at', { ascending: false }).limit(3),
      supabaseAdmin
        .from('asset_requests')
        .select('id, justification, status, created_at, updated_at')
        .eq('status', 'Fulfilled')
        .order('updated_at', { ascending: false })
        .limit(3),
      supabaseAdmin
        .from('asset_requests')
        .select('id, justification, status, created_at')
        .order('created_at', { ascending: false })
        .limit(4),
      supabaseAdmin
        .from('request_approvals')
        .select('id, approval_stage, status, comments, decided_at, created_at, request_id, asset_requests(justification)')
        .not('decided_at', 'is', null)
        .order('decided_at', { ascending: false })
        .limit(6),
      supabaseAdmin
        .from('notifications')
        .select('id, title, message, created_at')
        .order('created_at', { ascending: false })
        .limit(4),
      supabaseAdmin
        .from('assets')
        .select('asset_tag, name, updated_at')
        .eq('status', 'Allocated')
        .order('updated_at', { ascending: false })
        .limit(3),
    ]);

    return {
      auditRows: auditRes.data ?? [],
      assetRows: assetsRes.data ?? [],
      maintCompletedRows: maintCompletedRes.data ?? [],
      maintScheduledRows: maintScheduledRes.data ?? [],
      vendorRows: vendRes.data ?? [],
      fulfilledRequestRows: fulfilledReqRes.data ?? [],
      recentRequestRows: recentReqRes.data ?? [],
      approvalRows: approvalRes.data ?? [],
      notificationRows: notifRes.data ?? [],
      allocationRows: allocRes.data ?? [],
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to load activity stream.' };
  }
}
