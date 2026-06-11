'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { formatRequestLabel } from '@/lib/supabase/requests';
import { createProcurementAction } from '@/app/actions/brd/procurement';
import { getBrdFormLookupsAction, listVendorOptionsAction } from '@/app/actions/brd/lookups';
import { BrdRoleGate } from '@/components/brd/role-gate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { Skeleton } from '@/components/common/Skeleton';
import { ArrowLeftIcon, Loader2Icon } from 'lucide-react';
import { optionalNoneLabel } from '@/lib/display-labels';

export default function NewProcurementPage() {
  return (
    <BrdRoleGate allowed={['Admin']}>
      <NewProcurementForm />
    </BrdRoleGate>
  );
}

function NewProcurementForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRequestId = searchParams.get('requestId');
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [requests, setRequests] = useState<{ id: string; justification: string; status: string }[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [requestId, setRequestId] = useState('NONE');
  const [vendorId, setVendorId] = useState('NONE');
  const [priority, setPriority] = useState('Medium');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedRequestLabel =
    requestId === 'NONE'
      ? 'None'
      : formatRequestLabel(requests.find((request) => request.id === requestId)?.justification);

  const selectedVendorLabel = optionalNoneLabel(
    vendorId,
    vendors.find((v) => v.id === vendorId)?.name,
    'Optional vendor'
  );

  useEffect(() => {
    Promise.all([getBrdFormLookupsAction(), listVendorOptionsAction()]).then(([lookups, vendorResult]) => {
      setVendors(vendorResult.data ?? lookups.vendors ?? []);
      const loadedRequests = lookups.procurementRequests ?? [];
      setRequests(loadedRequests);
      if (initialRequestId && loadedRequests.some((req) => req.id === initialRequestId)) {
        setRequestId(initialRequestId);
      }
      const lookupError = [lookups.error, vendorResult.error].filter(Boolean).join('; ');
      if (lookupError) setError(lookupError);
      setLoadingLookups(false);
    });
  }, [initialRequestId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required.'); return; }
    setSaving(true);
    const result = await createProcurementAction({
      title: title.trim(),
      description: description || null,
      request_id: requestId !== 'NONE' ? requestId : null,
      vendor_id: vendorId !== 'NONE' ? vendorId : null,
      priority,
      estimated_cost: estimatedCost ? parseFloat(estimatedCost) : null,
      notes: notes || null,
    });
    if (result.error) setError(result.error);
    else router.push('/dashboard/procurement');
    setSaving(false);
  };

  if (loadingLookups) return <Skeleton className="h-64 w-full rounded-xl" />;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link href="/dashboard/procurement" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="mr-2 h-4 w-4" />Back to Procurement
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>New Procurement</CardTitle>
          <CardDescription>Create a procurement case.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && <div className="mb-4"><ErrorAlert message={error} /></div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Procurement title" required />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
            </div>
            <div className="space-y-2">
              <Label>Linked Request</Label>
              <p className="text-xs text-muted-foreground">
                Only finance-approved requests are listed. Complete Manager → Procurement → Finance approvals first.
              </p>
              <Select value={requestId} onValueChange={(v) => setRequestId(v ?? 'NONE')}>
                <SelectTrigger><span className="truncate">{selectedRequestLabel}</span></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None</SelectItem>
                  {requests.map((r) => <SelectItem key={r.id} value={r.id}>{formatRequestLabel(r.justification)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Vendor</Label>
              <Select value={vendorId} onValueChange={(v) => setVendorId(v ?? 'NONE')}>
                <SelectTrigger><span className="truncate">{selectedVendorLabel}</span></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None</SelectItem>
                  {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v ?? 'Medium')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estimated Cost ($)</Label>
              <Input type="number" step="0.01" min="0" value={estimatedCost} onChange={(e) => setEstimatedCost(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
            </div>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}Create Procurement
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
