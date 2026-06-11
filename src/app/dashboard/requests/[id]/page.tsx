'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getRequest, type AssetRequestWithRelations, formatRequestLabel } from '@/lib/supabase/requests';
import { getRequestApprovalHistoryAction } from '@/app/actions/brd/approvals';
import { formatPersonName } from '@/lib/display-labels';
import { isPendingRequestStatus, REQUEST_STATUS } from '@/lib/constants/request-status';
import { deleteRequestAction } from '@/app/actions/crud';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { ApprovalWorkflowTimeline } from '@/components/enterprise/approval-workflow-timeline';
import { GlassPanel } from '@/components/enterprise/glass-panel';
import type { RequestApproval } from '@/lib/brd/types';
import {
  RegistryDeleteDialog,
  RegistryDeleteDialogTriggerButton,
} from '@/components/common/delete-confirm-dialog';
import { isDeleteBlocked, type DeleteBlockingInfo } from '@/lib/delete/delete-fk-blocking';
import { ArrowLeftIcon, Loader2Icon, TrashIcon, ShieldCheck } from 'lucide-react';
import { canManageApprovals, canManageProcurement } from '@/lib/auth/roles';
import { findActionablePendingApproval } from '@/lib/brd/request-workflow';

export default function RequestDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { role } = useAuth();
  const [request, setRequest] = useState<AssetRequestWithRelations | null>(null);
  const [approvals, setApprovals] = useState<RequestApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteBlocking, setDeleteBlocking] = useState<DeleteBlockingInfo | null>(null);

  useEffect(() => {
    async function loadReq() {
      try {
        const [reqRes, approvalRes] = await Promise.all([
          getRequest(id),
          getRequestApprovalHistoryAction(id),
        ]);
        if (reqRes.error) {
          setError(reqRes.error.message);
        } else if (reqRes.data) {
          setRequest(reqRes.data);
        } else {
          setError('Request not found');
        }
        if (approvalRes.error) {
          setError(approvalRes.error);
        } else {
          setApprovals(approvalRes.data);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load request');
      } finally {
        setLoading(false);
      }
    }
    if (id) loadReq();
  }, [id]);

  const handleDelete = async () => {
    setUpdating(true);
    setDeleteBlocking(null);
    try {
      const result = await deleteRequestAction(id);
      if (isDeleteBlocked(result)) {
        setDeleteBlocking(result.blocking);
        setUpdating(false);
      } else if ('error' in result && result.error) {
        setError(result.error);
        setUpdating(false);
      } else {
        router.push('/dashboard/requests');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete request');
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2Icon className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <ErrorAlert message={error || 'Request not found'} />
        <Link href="/dashboard/requests">
          <Button variant="outline">Back to Requests</Button>
        </Link>
      </div>
    );
  }

  const pendingApproval = findActionablePendingApproval(approvals, request.status);
  const showApprovalLink = Boolean(pendingApproval) && canManageApprovals(role);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/dashboard/requests" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="mr-2 h-4 w-4" />
        Back to Requests
      </Link>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-2xl">{formatRequestLabel(request.justification, 120)}</CardTitle>
            <CardDescription className="mt-1">
              Created on {new Date(request.created_at).toLocaleString()}
              {request.fulfilled_at && (
                <> · Fulfilled {new Date(request.fulfilled_at).toLocaleString()}</>
              )}
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 items-end">
            <Badge variant={isPendingRequestStatus(request.status) ? 'outline' : 'secondary'}>
              {request.status}
            </Badge>
            <Badge variant={request.priority === 'High' ? 'destructive' : 'default'}>
              {request.priority} Priority
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && <ErrorAlert message={error} />}

          {showApprovalLink && pendingApproval ? (
            <div className="flex items-center justify-between rounded-xl border border-violet-500/20 bg-violet-500/10 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-violet-200">
                <ShieldCheck className="h-4 w-4" />
                {pendingApproval.approval_stage} approval pending
              </div>
              <Link href={`/dashboard/approvals/${pendingApproval.id}`}>
                <Button size="sm" variant="secondary">Review approval</Button>
              </Link>
            </div>
          ) : null}

          {request.status === REQUEST_STATUS.APPROVED && canManageProcurement(role) ? (
            <div className="flex items-center justify-between rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3">
              <p className="text-sm text-cyan-100">Finance approved — start procurement for this request.</p>
              <Link href={`/dashboard/procurement/new?requestId=${request.id}`}>
                <Button size="sm" variant="secondary">Create procurement</Button>
              </Link>
            </div>
          ) : null}

          {request.status === REQUEST_STATUS.RECEIVED ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
              <p className="text-sm text-emerald-100">Asset received — register hardware and allocate to the requester.</p>
              <div className="flex gap-2">
                <Link href={`/dashboard/assets/new?requestId=${request.id}`}>
                  <Button size="sm" variant="secondary">Register asset</Button>
                </Link>
                <Link href={`/dashboard/allocations/new?requestId=${request.id}`}>
                  <Button size="sm">Allocate asset</Button>
                </Link>
              </div>
            </div>
          ) : null}

          <div>
            <h3 className="font-semibold mb-1">Justification</h3>
            <p className="text-muted-foreground whitespace-pre-wrap">{request.justification || 'No justification provided.'}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="font-semibold mb-1">Requester</h3>
              <p className="text-muted-foreground">
                {formatPersonName(request.requester, 'Unknown')}
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-1">Category</h3>
              <p className="text-muted-foreground">
                {request.category?.name ?? 'Not specified'}
              </p>
            </div>
          </div>

          {(request.manager_approval_date || request.procurement_approval_date || request.finance_approval_date) && (
            <div className="grid gap-3 sm:grid-cols-3 text-sm">
              {request.manager_approval_date && (
                <div>
                  <p className="text-muted-foreground">Manager approved</p>
                  <p>{new Date(request.manager_approval_date).toLocaleString()}</p>
                </div>
              )}
              {request.procurement_approval_date && (
                <div>
                  <p className="text-muted-foreground">Procurement reviewed</p>
                  <p>{new Date(request.procurement_approval_date).toLocaleString()}</p>
                </div>
              )}
              {request.finance_approval_date && (
                <div>
                  <p className="text-muted-foreground">Finance approved</p>
                  <p>{new Date(request.finance_approval_date).toLocaleString()}</p>
                </div>
              )}
            </div>
          )}

          {request.rejection_reason && (
            <div>
              <h3 className="font-semibold mb-1">Rejection Reason</h3>
              <p className="text-muted-foreground">{request.rejection_reason}</p>
            </div>
          )}

          <div className="pt-6 flex justify-end">
            <RegistryDeleteDialogTriggerButton onClick={() => { setDeleteBlocking(null); setDeleteDialogOpen(true); }} disabled={updating}>
              <TrashIcon className="mr-2 h-4 w-4" />
              Delete Request
            </RegistryDeleteDialogTriggerButton>
          </div>
        </CardContent>
      </Card>

      <GlassPanel className="p-6">
        <ApprovalWorkflowTimeline requestStatus={request.status} approvals={approvals} />
      </GlassPanel>

      <RegistryDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setDeleteBlocking(null);
        }}
        title="Delete Request"
        description="Permanently remove this request. This action cannot be undone."
        detail={request ? formatRequestLabel(request.justification) : null}
        blocking={deleteBlocking}
        onConfirm={handleDelete}
        confirming={updating}
      />
    </div>
  );
}
