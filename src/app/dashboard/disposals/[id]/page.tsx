'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getDisposal } from '@/lib/supabase/brd/disposals';
import { decideDisposalAction } from '@/app/actions/brd/disposals';
import type { AssetDisposal } from '@/lib/brd/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/enterprise/status-badge';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { SuccessToast } from '@/components/common/SuccessToast';
import { ArrowLeftIcon, Loader2Icon, CheckIcon, XIcon, PackageCheckIcon } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { canApproveDisposal } from '@/lib/auth/roles';

export default function DisposalDetailPage() {
  const params = useParams();
  const { role } = useAuth();
  const id = params.id as string;
  const [row, setRow] = useState<AssetDisposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    getDisposal(id).then(({ data, error: e }) => {
      if (e) setError(e.message);
      else setRow(data);
      setLoading(false);
    });
  }, [id]);

  const handleDecide = async (decision: 'Approved' | 'Rejected' | 'Completed') => {
    setActing(true);
    const r = await decideDisposalAction(id, decision);
    if (r.error) setError(r.error);
    else {
      setToast(`Disposal ${decision.toLowerCase()}.`);
      getDisposal(id).then(({ data }) => setRow(data));
    }
    setActing(false);
  };

  if (loading) return <div className="flex h-48 items-center justify-center"><Loader2Icon className="h-8 w-8 animate-spin" /></div>;
  if (!row) return <ErrorAlert message={error || 'Not found'} />;

  const canDecide = canApproveDisposal(role);
  const isPending = row.status === 'Pending';
  const isApproved = row.status === 'Approved';

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {toast && <SuccessToast message={toast} onDismiss={() => setToast(null)} />}
      <Link href="/dashboard/disposals" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="mr-2 h-4 w-4" />Back
      </Link>
      {error && <ErrorAlert message={error} />}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>{row.assets?.name ?? 'Disposal Request'}</CardTitle>
            <p className="text-sm text-muted-foreground">{row.assets?.asset_tag}</p>
          </div>
          <StatusBadge status={row.status} />
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p><span className="text-muted-foreground">Reason:</span> {row.reason}</p>
          <p><span className="text-muted-foreground">Method:</span> {row.disposal_method ?? '—'}</p>
          <p><span className="text-muted-foreground">Disposal date:</span> {row.disposal_date ? new Date(row.disposal_date).toLocaleDateString() : '—'}</p>
          <p><span className="text-muted-foreground">Salvage value:</span> {row.salvage_value != null ? `$${row.salvage_value.toLocaleString()}` : '—'}</p>
          <p><span className="text-muted-foreground">Requested:</span> {new Date(row.created_at).toLocaleString()}</p>
          {row.notes && <p><span className="text-muted-foreground">Notes:</span> {row.notes}</p>}
          {canDecide && (isPending || isApproved) && (
            <div className="flex flex-wrap gap-2 pt-4">
              {isPending && (
                <>
                  <Button onClick={() => handleDecide('Approved')} disabled={acting}>
                    <CheckIcon className="mr-2 h-4 w-4" />Approve
                  </Button>
                  <Button variant="destructive" onClick={() => handleDecide('Rejected')} disabled={acting}>
                    <XIcon className="mr-2 h-4 w-4" />Reject
                  </Button>
                </>
              )}
              {isApproved && (
                <Button onClick={() => handleDecide('Completed')} disabled={acting}>
                  <PackageCheckIcon className="mr-2 h-4 w-4" />Mark Completed
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
