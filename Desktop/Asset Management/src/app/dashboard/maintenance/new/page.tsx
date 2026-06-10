'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createMaintenanceAction, getMaintenanceLookupsAction } from '@/app/actions/crud';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { EmptyState } from '@/components/common/EmptyState';
import { SuccessToast } from '@/components/common/SuccessToast';
import { Skeleton } from '@/components/common/Skeleton';
import { ArrowLeftIcon, Loader2Icon, PlusIcon } from 'lucide-react';
import { formatAssetLabel, labelFromOptions, optionalNoneLabel } from '@/lib/display-labels';

export default function NewMaintenancePage() {
  const router = useRouter();

  const [assets, setAssets] = useState<{ id: string; name: string; asset_tag: string }[]>([]);
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(true);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [assetId, setAssetId] = useState('');
  const [vendorId, setVendorId] = useState('NONE_SELECTED');
  const [type, setType] = useState('Preventive');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [completedDate, setCompletedDate] = useState('');
  const [performedBy, setPerformedBy] = useState('');
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const loadLookups = useCallback(async () => {
    setLoadingLookups(true);
    setLookupError(null);
    try {
      const result = await getMaintenanceLookupsAction();
      if (result.error && !result.data) {
        setLookupError(result.error);
        setAssets([]);
        setVendors([]);
        return;
      }
      setAssets(result.data?.assets ?? []);
      setVendors(result.data?.vendors ?? []);
      if (result.error) setLookupError(result.error);
      else if (result.warnings?.length) setLookupError(result.warnings.join(' '));
    } catch (err: unknown) {
      setLookupError(err instanceof Error ? err.message : 'Failed to load assets and vendors');
    } finally {
      setLoadingLookups(false);
    }
  }, []);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!assetId) {
      setError('Please select an asset.');
      return;
    }
    if (!type) {
      setError('Please select a maintenance type.');
      return;
    }
    if (!description.trim()) {
      setError('Description is required.');
      return;
    }
    if (cost && (Number.isNaN(parseFloat(cost)) || parseFloat(cost) < 0)) {
      setError('Cost must be a valid positive number.');
      return;
    }

    setSaving(true);
    try {
      const result = await createMaintenanceAction({
        asset_id: assetId,
        type,
        description: description.trim(),
        vendor_id: vendorId !== 'NONE_SELECTED' ? vendorId : null,
        cost: cost ? parseFloat(cost) : null,
        scheduled_date: scheduledDate || null,
        completed_date: completedDate || null,
        performed_by: performedBy.trim() || null,
        notes: notes.trim() || null,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setSuccessToast('Maintenance record logged successfully.');
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('maintenance-created', '1');
      }
      setTimeout(() => {
        router.push('/dashboard/maintenance');
      }, 900);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create maintenance record');
    } finally {
      setSaving(false);
    }
  };

  const dismissToast = useCallback(() => setSuccessToast(null), []);

  const selectedAssetLabel = labelFromOptions(assets, assetId, formatAssetLabel, 'Select an asset');
  const selectedVendorLabel = optionalNoneLabel(
    vendorId,
    vendors.find((v) => v.id === vendorId)?.name,
    'Optional vendor'
  );

  return (
    <div className="mx-auto max-w-xl space-y-6">
      {successToast && <SuccessToast message={successToast} onDismiss={dismissToast} />}

      <Link href="/dashboard/maintenance" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="mr-2 h-4 w-4" />
        Back to Maintenance
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Log Maintenance Record</CardTitle>
          <CardDescription>Create a new preventive or corrective maintenance record.</CardDescription>
        </CardHeader>
        <CardContent>
          {lookupError && !loadingLookups && (
            <div className="mb-4"><ErrorAlert message={lookupError} /></div>
          )}
          {error && <div className="mb-4"><ErrorAlert message={error} /></div>}

          {loadingLookups ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
              <div className="flex h-20 items-center justify-center">
                <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Loading assets and vendors…</span>
              </div>
            </div>
          ) : assets.length === 0 ? (
            <EmptyState
              title="No assets available"
              description="Register assets in the system before logging maintenance records."
              action={
                <Link href="/dashboard/assets/new">
                  <Button className="rounded-xl">
                    <PlusIcon className="mr-2 h-4 w-4" />
                    Register Asset
                  </Button>
                </Link>
              }
            />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="asset-select">Asset *</Label>
                <Select value={assetId} onValueChange={(val) => setAssetId(val ?? '')} required>
                  <SelectTrigger id="asset-select">
                    <span className="truncate">{selectedAssetLabel}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {assets.map((asset) => (
                      <SelectItem key={asset.id} value={asset.id}>
                        {asset.name} ({asset.asset_tag})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maintenance-type">Maintenance Type *</Label>
                <Select value={type} onValueChange={(val) => setType(val ?? 'Preventive')} required>
                  <SelectTrigger id="maintenance-type">
                    <SelectValue placeholder="Select maintenance type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Preventive">Preventive</SelectItem>
                    <SelectItem value="Corrective">Corrective</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vendor-select">Vendor</Label>
                <Select value={vendorId} onValueChange={(val) => setVendorId(val ?? 'NONE_SELECTED')}>
                  <SelectTrigger id="vendor-select">
                    <span className="truncate">{selectedVendorLabel}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE_SELECTED">None (No vendor)</SelectItem>
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {vendors.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No vendors found.{' '}
                    <Link href="/dashboard/vendors/new" className="text-primary hover:underline">
                      Add a vendor
                    </Link>
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description / Issue *</Label>
                <Input
                  id="description"
                  placeholder="e.g. Routine inspection, screen replacement..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cost">Cost ($)</Label>
                  <Input
                    id="cost"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="performed-by">Performed By</Label>
                  <Input
                    id="performed-by"
                    placeholder="e.g. John Doe, ACME Support..."
                    value={performedBy}
                    onChange={(e) => setPerformedBy(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="scheduled-date">Scheduled Date</Label>
                  <Input
                    id="scheduled-date"
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="completed-date">Completed Date</Label>
                  <Input
                    id="completed-date"
                    type="date"
                    value={completedDate}
                    onChange={(e) => setCompletedDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  placeholder="Any additional details or comments..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={saving || !assetId}>
                  {saving && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
                  Log Maintenance
                </Button>
                <Link href="/dashboard/maintenance">
                  <Button variant="outline" type="button">Cancel</Button>
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
