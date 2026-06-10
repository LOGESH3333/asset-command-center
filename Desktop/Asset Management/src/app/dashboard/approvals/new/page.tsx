'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createApprovalAction } from '@/app/actions/brd/approvals';
import { getBrdFormLookupsAction } from '@/app/actions/brd/lookups';
import { BrdRoleGate } from '@/components/brd/role-gate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { EmptyState } from '@/components/common/EmptyState';
import { Skeleton } from '@/components/common/Skeleton';
import { ArrowLeftIcon, Loader2Icon } from 'lucide-react';
import type { ApprovalStage } from '@/lib/brd/types';
import { formatRequestLabel } from '@/lib/supabase/requests';
import { labelFromOptions } from '@/lib/display-labels';
import { REQUEST_STATUS_FOR_STAGE } from '@/lib/brd/request-workflow';

export default function NewApprovalPage() {
  return (
    <BrdRoleGate allowed={['Admin', 'Manager']}>
      <NewApprovalForm />
    </BrdRoleGate>
  );
}

function NewApprovalForm() {
  const router = useRouter();
  const [requests, setRequests] = useState<{ id: string; justification: string; status: string }[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(true);
  const [requestId, setRequestId] = useState('');
  const [stage, setStage] = useState<ApprovalStage>('Manager');
  const [comments, setComments] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eligibleRequests = requests.filter(
    (r) => r.status === REQUEST_STATUS_FOR_STAGE[stage as ApprovalStage]
  );

  const selectedRequestLabel = labelFromOptions(
    eligibleRequests,
    requestId,
    (r) => `${formatRequestLabel(r.justification)} (${r.status})`,
    'Select request'
  );

  useEffect(() => {
    getBrdFormLookupsAction().then((r) => {
      setRequests(r.requests ?? []);
      if (r.error) setError(r.error);
      setLoadingLookups(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestId) { setError('Select a request.'); return; }
    setSaving(true);
    const result = await createApprovalAction({
      request_id: requestId,
      approval_stage: stage,
      comments: comments || null,
    });
    if (result.error) setError(result.error);
    else router.push('/dashboard/approvals');
    setSaving(false);
  };

  if (loadingLookups) return <Skeleton className="h-64 w-full rounded-xl" />;

  if (requests.length === 0) {
    return (
      <EmptyState
        title="No requests available"
        description="Create an asset request before adding approvals."
        action={<Link href="/dashboard/requests/new"><Button>New Request</Button></Link>}
      />
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link href="/dashboard/approvals" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="mr-2 h-4 w-4" />Back to Approvals
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>New Request Approval</CardTitle>
          <CardDescription>Create an approval record for an asset request.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && <div className="mb-4"><ErrorAlert message={error} /></div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Asset Request *</Label>
              <Select value={requestId} onValueChange={(v) => setRequestId(v ?? '')}>
                <SelectTrigger><span className="truncate">{selectedRequestLabel}</span></SelectTrigger>
                <SelectContent>
                  {eligibleRequests.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{formatRequestLabel(r.justification)} ({r.status})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Approval Stage *</Label>
              <Select value={stage} onValueChange={(v) => setStage((v ?? 'Manager') as ApprovalStage)}>
                <SelectTrigger><SelectValue placeholder="Select stage" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Manager">Manager</SelectItem>
                  <SelectItem value="Procurement">Procurement</SelectItem>
                  <SelectItem value="Finance">Finance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Comments</Label>
              <Input value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Optional comments" />
            </div>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}Create Approval
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
