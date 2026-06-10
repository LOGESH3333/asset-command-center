'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getApproval } from '@/lib/supabase/brd/approvals';
import { formatRequestLabel } from '@/lib/supabase/requests';
import { decideApprovalAction } from '@/app/actions/brd/approvals';
import type { RequestApproval } from '@/lib/brd/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/enterprise/status-badge';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { SuccessToast } from '@/components/common/SuccessToast';
import { ArrowLeftIcon, Loader2Icon, CheckIcon, XIcon } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { canManageApprovals } from '@/lib/auth/roles';

export default function ApprovalDetailPage() {
  const params = useParams();
  const { role } = useAuth();
  const id = params.id as string;
  const [row, setRow] = useState<RequestApproval | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [comments, setComments] = useState('');

  useEffect(() => {
    getApproval(id).then(({ data, error: e }) => {
      if (e) setError(e.message);
      else setRow(data);
      setLoading(false);
    });
  }, [id]);

  const handleDecide = async (decision: 'Approved' | 'Rejected') => {
    setActing(true);
    const r = await decideApprovalAction(id, decision, comments || null);
    if (r.error) setError(r.error);
    else {
      setToast(`Approval ${decision.toLowerCase()}.`);
      getApproval(id).then(({ data }) => setRow(data));
    }
    setActing(false);
  };

  if (loading) return <div className="flex h-48 items-center justify-center"><Loader2Icon className="h-8 w-8 animate-spin" /></div>;
  if (!row) return <ErrorAlert message={error || 'Not found'} />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {toast && <SuccessToast message={toast} onDismiss={() => setToast(null)} />}
      <Link href="/dashboard/approvals" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="mr-2 h-4 w-4" />Back
      </Link>
      {error && <ErrorAlert message={error} />}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>{formatRequestLabel(row.asset_requests?.justification) || 'Approval'}</CardTitle>
            <p className="text-sm text-muted-foreground">{row.approval_stage} stage</p>
          </div>
          <StatusBadge status={row.status} />
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>
            <span className="text-muted-foreground">Request:</span>{' '}
            {row.asset_requests?.id ? (
              <Link href={`/dashboard/requests/${row.asset_requests.id}`} className="text-primary hover:underline">
                {formatRequestLabel(row.asset_requests.justification)}
              </Link>
            ) : (
              '—'
            )}
          </p>
          <p><span className="text-muted-foreground">Request status:</span> {row.asset_requests?.status ?? '—'}</p>
          <p><span className="text-muted-foreground">Approver:</span> {row.users ? `${row.users.first_name} ${row.users.last_name}` : '—'}</p>
          <p><span className="text-muted-foreground">Created:</span> {new Date(row.created_at).toLocaleString()}</p>
          <p><span className="text-muted-foreground">Decided:</span> {row.decided_at ? new Date(row.decided_at).toLocaleString() : 'Pending'}</p>
          {row.comments && <p><span className="text-muted-foreground">Comments:</span> {row.comments}</p>}
          {row.status === 'Pending' && canManageApprovals(role) && (
            <div className="space-y-3 pt-4">
              <div className="space-y-2">
                <Label>Decision comments</Label>
                <Input value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Optional comments" />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => handleDecide('Approved')} disabled={acting}>
                  <CheckIcon className="mr-2 h-4 w-4" />Approve
                </Button>
                <Button variant="destructive" onClick={() => handleDecide('Rejected')} disabled={acting}>
                  <XIcon className="mr-2 h-4 w-4" />Reject
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
