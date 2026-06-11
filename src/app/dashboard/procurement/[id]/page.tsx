'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { formatRequestLabel } from '@/lib/supabase/requests';
import { getProcurementAction, updateProcurementAction } from '@/app/actions/brd/procurement';
import type { Procurement } from '@/lib/brd/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/enterprise/status-badge';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { SuccessToast } from '@/components/common/SuccessToast';
import { ArrowLeftIcon, Loader2Icon } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { canManageProcurement } from '@/lib/auth/roles';

const STATUSES = ['Draft', 'Submitted', 'Approved', 'Ordered', 'Closed', 'Cancelled'];

export default function ProcurementDetailPage() {
  const params = useParams();
  const { role } = useAuth();
  const id = params.id as string;
  const [row, setRow] = useState<Procurement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    getProcurementAction(id).then((result) => {
      if (result.error) setError(result.error);
      else setRow(result.data);
      setLoading(false);
    });
  }, [id]);

  const handleStatusChange = async (newStatus: string) => {
    setActing(true);
    const r = await updateProcurementAction(id, { status: newStatus });
    if (r.error) setError(r.error);
    else {
      setToast(`Status updated to ${newStatus}.`);
      getProcurementAction(id).then((result) => {
        if (result.data) setRow(result.data);
      });
    }
    setActing(false);
  };

  if (loading) return <div className="flex h-48 items-center justify-center"><Loader2Icon className="h-8 w-8 animate-spin" /></div>;
  if (!row) return <ErrorAlert message={error || 'Not found'} />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {toast && <SuccessToast message={toast} onDismiss={() => setToast(null)} />}
      <Link href="/dashboard/procurement" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="mr-2 h-4 w-4" />Back
      </Link>
      {error && <ErrorAlert message={error} />}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>{row.title}</CardTitle>
            <p className="text-sm text-muted-foreground">{formatRequestLabel(row.asset_requests?.justification) || 'No linked request'}</p>
          </div>
          <StatusBadge status={row.status} />
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {row.description && <p><span className="text-muted-foreground">Description:</span> {row.description}</p>}
          <p><span className="text-muted-foreground">Priority:</span> {row.priority}</p>
          <p><span className="text-muted-foreground">Vendor:</span> {row.vendors?.name ?? '—'}</p>
          <p><span className="text-muted-foreground">Est. cost:</span> {row.estimated_cost != null ? `$${row.estimated_cost.toLocaleString()}` : '—'}</p>
          <p><span className="text-muted-foreground">Created:</span> {new Date(row.created_at).toLocaleString()}</p>
          {row.notes && <p><span className="text-muted-foreground">Notes:</span> {row.notes}</p>}
          {canManageProcurement(role) && (
            <div className="space-y-2 pt-4">
              <p className="text-muted-foreground">Update status</p>
              <Select value={row.status} onValueChange={(v) => { if (v) handleStatusChange(v); }} disabled={acting}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
