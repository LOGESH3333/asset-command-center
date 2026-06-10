'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getAllocation } from '@/lib/supabase/brd/allocations';
import { acknowledgeAllocationAction, returnAllocationAction } from '@/app/actions/brd/allocations';
import type { AssetAllocation } from '@/lib/brd/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/enterprise/status-badge';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { SuccessToast } from '@/components/common/SuccessToast';
import { ArrowLeftIcon, Loader2Icon, CheckIcon, UndoIcon } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { canManageAllocations } from '@/lib/auth/roles';

export default function AllocationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { role } = useAuth();
  const id = params.id as string;
  const [row, setRow] = useState<AssetAllocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    getAllocation(id).then(({ data, error: e }) => {
      if (e) setError(e.message);
      else setRow(data);
      setLoading(false);
    });
  }, [id]);

  const handleAck = async () => {
    setActing(true);
    const r = await acknowledgeAllocationAction(id);
    if (r.error) setError(r.error);
    else { setToast('Allocation acknowledged.'); router.refresh(); getAllocation(id).then(({ data }) => setRow(data)); }
    setActing(false);
  };

  const handleReturn = async () => {
    setActing(true);
    const r = await returnAllocationAction(id);
    if (r.error) setError(r.error);
    else { setToast('Asset returned.'); router.push('/dashboard/allocations'); }
    setActing(false);
  };

  if (loading) return <div className="flex h-48 items-center justify-center"><Loader2Icon className="h-8 w-8 animate-spin" /></div>;
  if (!row) return <ErrorAlert message={error || 'Not found'} />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {toast && <SuccessToast message={toast} onDismiss={() => setToast(null)} />}
      <Link href="/dashboard/allocations" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="mr-2 h-4 w-4" />Back
      </Link>
      {error && <ErrorAlert message={error} />}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>{row.assets?.name ?? 'Allocation'}</CardTitle>
            <p className="text-sm text-muted-foreground">{row.assets?.asset_tag}</p>
          </div>
          <StatusBadge status={row.status} />
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p><span className="text-muted-foreground">Employee:</span> {row.users ? `${row.users.first_name} ${row.users.last_name}` : '—'}</p>
          <p><span className="text-muted-foreground">Allocated:</span> {new Date(row.allocated_at ?? row.created_at).toLocaleString()}</p>
          <p><span className="text-muted-foreground">Acknowledged:</span> {row.acknowledged_at ? new Date(row.acknowledged_at).toLocaleString() : 'Pending'}</p>
          {row.notes && <p><span className="text-muted-foreground">Notes:</span> {row.notes}</p>}
          <div className="flex gap-2 pt-4">
            {!row.acknowledged_at && (
              <Button onClick={handleAck} disabled={acting}><CheckIcon className="mr-2 h-4 w-4" />Acknowledge Receipt</Button>
            )}
            {row.status === 'Active' && canManageAllocations(role) && (
              <Button variant="outline" onClick={handleReturn} disabled={acting}><UndoIcon className="mr-2 h-4 w-4" />Mark Returned</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
