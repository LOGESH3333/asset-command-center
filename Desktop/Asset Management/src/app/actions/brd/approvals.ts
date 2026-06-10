'use server';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { requireBrdRole } from './_auth';
import { createBrdNotification } from '@/lib/brd/notify';
import { REQUEST_STATUS } from '@/lib/constants/request-status';
import { formatAuditTriggerDbError } from '@/lib/supabase/audit-db-errors';
import type { ApprovalStage } from '@/lib/brd/types';
import {
  NEXT_APPROVAL_STAGE,
  STAGE_APPROVER_FIELDS,
  getNextRequestStatusAfterApproval,
  validateApprovalStageForRequest,
} from '@/lib/brd/request-workflow';

function revalidateApprovals() {
  revalidatePath('/dashboard/approvals');
  revalidatePath('/dashboard/requests');
  revalidatePath('/dashboard');
}

/** Create the initial Manager approval when a request is submitted. */
export async function bootstrapRequestWorkflow(requestId: string) {
  const { data: existing } = await supabaseAdmin
    .from('request_approvals')
    .select('id')
    .eq('request_id', requestId)
    .eq('approval_stage', 'Manager')
    .maybeSingle();

  if (existing?.id) return { success: true, id: existing.id };

  const { data, error } = await supabaseAdmin
    .from('request_approvals')
    .insert([
      {
        request_id: requestId,
        approval_stage: 'Manager',
        status: 'Pending',
      },
    ])
    .select('id')
    .single();

  if (error) return { error: formatAuditTriggerDbError(error.message) };

  await createBrdNotification({
    title: 'Manager approval required',
    message: 'A new asset request is awaiting manager approval.',
  });

  return { success: true, id: data?.id };
}

async function createNextStageApproval(requestId: string, stage: ApprovalStage) {
  const { data: dup } = await supabaseAdmin
    .from('request_approvals')
    .select('id')
    .eq('request_id', requestId)
    .eq('approval_stage', stage)
    .eq('status', 'Pending')
    .maybeSingle();

  if (dup?.id) return;

  await supabaseAdmin.from('request_approvals').insert([
    {
      request_id: requestId,
      approval_stage: stage,
      status: 'Pending',
    },
  ]);

  await createBrdNotification({
    title: `${stage} approval required`,
    message: `Asset request advanced to ${stage} review.`,
  });
}

export async function createApprovalAction(input: {
  request_id: string;
  approval_stage: ApprovalStage;
  comments?: string | null;
}) {
  const auth = await requireBrdRole(['Admin', 'Manager']);
  if (auth.error) return { error: auth.error };

  if (!input.request_id) return { error: 'Request is required.' };

  const { data: request, error: reqErr } = await supabaseAdmin
    .from('asset_requests')
    .select('id, status')
    .eq('id', input.request_id)
    .single();

  if (reqErr || !request) return { error: 'Request not found.' };

  const stageError = validateApprovalStageForRequest(input.approval_stage, request.status);
  if (stageError) return { error: stageError };

  const { data: existing } = await supabaseAdmin
    .from('request_approvals')
    .select('id')
    .eq('request_id', input.request_id)
    .eq('approval_stage', input.approval_stage)
    .eq('status', 'Pending')
    .maybeSingle();

  if (existing?.id) {
    return { error: `A pending ${input.approval_stage} approval already exists for this request.` };
  }

  const { data, error } = await supabaseAdmin
    .from('request_approvals')
    .insert([
      {
        request_id: input.request_id,
        approver_id: auth.profile?.id ?? null,
        approval_stage: input.approval_stage,
        status: 'Pending',
        comments: input.comments?.trim() || null,
      },
    ])
    .select('id')
    .single();

  if (error) return { error: formatAuditTriggerDbError(error.message) };

  await createBrdNotification({
    title: 'Approval required',
    message: `New ${input.approval_stage} approval pending for asset request.`,
  });

  revalidateApprovals();
  return { success: true, id: data?.id };
}

export async function decideApprovalAction(
  id: string,
  decision: 'Approved' | 'Rejected',
  comments?: string | null
) {
  const auth = await requireBrdRole(['Admin', 'Manager']);
  if (auth.error) return { error: auth.error };

  const { data: approval, error: fetchErr } = await supabaseAdmin
    .from('request_approvals')
    .select('id, request_id, approval_stage, status, asset_requests(id, status, justification)')
    .eq('id', id)
    .single();

  if (fetchErr || !approval) {
    return { error: fetchErr?.message ?? 'Approval not found.' };
  }

  if (approval.status !== 'Pending') {
    return { error: 'This approval has already been decided.' };
  }

  const requestRaw = approval.asset_requests as
    | { id: string; status: string; justification: string }
    | { id: string; status: string; justification: string }[]
    | null;
  const request = Array.isArray(requestRaw) ? requestRaw[0] : requestRaw;

  if (!request) return { error: 'Linked request not found.' };

  const stage = approval.approval_stage as ApprovalStage;
  const stageError = validateApprovalStageForRequest(stage, request.status);
  if (stageError) return { error: stageError };

  const now = new Date().toISOString();
  const trimmedComments = comments?.trim() || null;

  const { error } = await supabaseAdmin
    .from('request_approvals')
    .update({
      status: decision,
      approver_id: auth.profile?.id ?? null,
      decided_at: now,
      comments: trimmedComments,
    })
    .eq('id', id);

  if (error) return { error: formatAuditTriggerDbError(error.message) };

  if (decision === 'Rejected') {
    await supabaseAdmin
      .from('asset_requests')
      .update({
        status: REQUEST_STATUS.REJECTED,
        rejection_reason: trimmedComments ?? `Rejected at ${stage} stage`,
      })
      .eq('id', approval.request_id);
  } else {
    const fields = STAGE_APPROVER_FIELDS[stage];
    const nextStatus = getNextRequestStatusAfterApproval(stage);

    const requestUpdate: Record<string, unknown> = {
      status: nextStatus,
      [fields.idField]: auth.profile?.id ?? null,
      [fields.dateField]: now,
    };

    await supabaseAdmin.from('asset_requests').update(requestUpdate).eq('id', approval.request_id);

    const nextStage = NEXT_APPROVAL_STAGE[stage];
    if (nextStage) {
      await createNextStageApproval(approval.request_id, nextStage);
    } else {
      await createBrdNotification({
        title: 'Request fully approved',
        message: `Finance approved request: ${request.justification?.slice(0, 80) ?? 'asset request'}. Procurement may proceed.`,
      });
    }
  }

  await createBrdNotification({
    title: `Request ${decision.toLowerCase()}`,
    message: `${stage} stage ${decision.toLowerCase()} for asset request.`,
  });

  revalidateApprovals();
  return { success: true };
}

export async function deleteApprovalAction(id: string) {
  const auth = await requireBrdRole(['Admin']);
  if (auth.error) return { error: auth.error };

  const { error } = await supabaseAdmin.from('request_approvals').delete().eq('id', id);
  if (error) return { error: formatAuditTriggerDbError(error.message) };

  revalidateApprovals();
  return { success: true };
}
