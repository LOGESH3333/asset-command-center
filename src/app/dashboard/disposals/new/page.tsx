'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createDisposalAction } from '@/app/actions/brd/disposals';
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
import type { DisposalMethod } from '@/lib/brd/types';
import { formatAssetLabel, labelFromOptions } from '@/lib/display-labels';

export default function NewDisposalPage() {
  return (
    <BrdRoleGate allowed={['Admin', 'Manager', 'Employee']}>
      <NewDisposalForm />
    </BrdRoleGate>
  );
}

function NewDisposalForm() {
  const router = useRouter();
  const [assets, setAssets] = useState<{ id: string; name: string; asset_tag: string }[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(true);
  const [assetId, setAssetId] = useState('');
  const [reason, setReason] = useState('');
  const [method, setMethod] = useState<DisposalMethod | 'NONE'>('NONE');
  const [disposalDate, setDisposalDate] = useState('');
  const [salvageValue, setSalvageValue] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedAssetLabel = labelFromOptions(assets, assetId, formatAssetLabel, 'Select asset');

  useEffect(() => {
    getBrdFormLookupsAction().then((r) => {
      setAssets(r.assets ?? []);
      if (r.error) setError(r.error);
      setLoadingLookups(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetId || !reason.trim()) { setError('Asset and reason are required.'); return; }
    setSaving(true);
    const result = await createDisposalAction({
      asset_id: assetId,
      reason: reason.trim(),
      disposal_method: method !== 'NONE' ? method : null,
      disposal_date: disposalDate || null,
      salvage_value: salvageValue ? parseFloat(salvageValue) : null,
      notes: notes || null,
    });
    if (result.error) setError(result.error);
    else router.push('/dashboard/disposals');
    setSaving(false);
  };

  if (loadingLookups) return <Skeleton className="h-64 w-full rounded-xl" />;

  if (assets.length === 0) {
    return (
      <EmptyState
        title="No assets available"
        description="Register assets before submitting disposal requests."
        action={<Link href="/dashboard/assets/new"><Button>Register Asset</Button></Link>}
      />
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link href="/dashboard/disposals" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="mr-2 h-4 w-4" />Back to Disposals
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>New Disposal Request</CardTitle>
          <CardDescription>Request retirement or disposal of an asset.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && <div className="mb-4"><ErrorAlert message={error} /></div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Asset *</Label>
              <Select value={assetId} onValueChange={(v) => setAssetId(v ?? '')}>
                <SelectTrigger><span className="truncate">{selectedAssetLabel}</span></SelectTrigger>
                <SelectContent>
                  {assets.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} ({a.asset_tag})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reason *</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for disposal" required />
            </div>
            <div className="space-y-2">
              <Label>Disposal Method</Label>
              <Select value={method} onValueChange={(v) => setMethod((v ?? 'NONE') as DisposalMethod | 'NONE')}>
                <SelectTrigger><SelectValue placeholder="Optional method" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None</SelectItem>
                  <SelectItem value="Recycle">Recycle</SelectItem>
                  <SelectItem value="Donate">Donate</SelectItem>
                  <SelectItem value="Sell">Sell</SelectItem>
                  <SelectItem value="Destroy">Destroy</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Disposal Date</Label>
                <Input type="date" value={disposalDate} onChange={(e) => setDisposalDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Salvage Value ($)</Label>
                <Input type="number" step="0.01" min="0" value={salvageValue} onChange={(e) => setSalvageValue(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
            </div>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}Submit Disposal Request
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
