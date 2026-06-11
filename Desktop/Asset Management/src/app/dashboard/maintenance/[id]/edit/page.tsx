'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getMaintenanceRecord } from '@/lib/supabase/maintenance';
import { getMaintenanceLookupsAction, updateMaintenanceAction } from '@/app/actions/crud';
import { EmptyState } from '@/components/common/EmptyState';
import { Skeleton } from '@/components/common/Skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { ArrowLeftIcon, Loader2Icon } from 'lucide-react';
import { formatAssetLabel, labelFromOptions, optionalNoneLabel } from '@/lib/display-labels';

export default function EditMaintenancePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [assets, setAssets] = useState<{ id: string; name: string; asset_tag: string }[]>([]);
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(true);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Form states
  const [assetId, setAssetId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [type, setType] = useState('Preventive');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [completedDate, setCompletedDate] = useState('');
  const [performedBy, setPerformedBy] = useState('');
  const [notes, setNotes] = useState('');

  const [loadingRecord, setLoadingRecord] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadLookupsAndRecord() {
      try {
        const [optionsRes, recordRes] = await Promise.all([
          getMaintenanceLookupsAction(),
          getMaintenanceRecord(id),
        ]);

        if (optionsRes.error && !optionsRes.data) {
          throw new Error(optionsRes.error);
        }
        if (recordRes.error) {
          throw new Error(`Failed to load maintenance record: ${recordRes.error.message}`);
        }

        setAssets(optionsRes.data?.assets ?? []);
        setVendors(optionsRes.data?.vendors ?? []);

        if (recordRes.data) {
          const rec = recordRes.data;
          setAssetId(rec.asset_id || '');
          setVendorId(rec.vendor_id || 'NONE_SELECTED');
          setType(rec.type || 'Preventive');
          setDescription(rec.description || '');
          setCost(rec.cost !== null ? String(rec.cost) : '');
          setScheduledDate(rec.scheduled_date || '');
          setCompletedDate(rec.completed_date || '');
          setPerformedBy(rec.performed_by || '');
          setNotes(rec.notes || '');
        } else {
          throw new Error('Maintenance record not found');
        }
      } catch (err: any) {
        setLookupError(err.message ?? 'Failed to load details');
      } finally {
        setLoadingLookups(false);
        setLoadingRecord(false);
      }
    }

    loadLookupsAndRecord();
  }, [id]);

  const selectedAssetLabel = labelFromOptions(assets, assetId, formatAssetLabel, 'Select an asset');
  const selectedVendorLabel = optionalNoneLabel(
    vendorId,
    vendors.find((v) => v.id === vendorId)?.name,
    'Optional vendor'
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!assetId) {
      setError('Please select an asset.');
      return;
    }
    if (!description.trim()) {
      setError('Description is required.');
      return;
    }

    setSaving(true);
    try {
      const result = await updateMaintenanceAction(id, {
        asset_id: assetId,
        type,
        description: description.trim(),
        vendor_id: vendorId && vendorId !== 'NONE_SELECTED' ? vendorId : null,
        cost: cost ? parseFloat(cost) : null,
        scheduled_date: scheduledDate || null,
        completed_date: completedDate || null,
        performed_by: performedBy.trim() || null,
        notes: notes.trim() || null,
      });

      if (result.error) {
        setError(result.error);
      } else {
        router.push(`/dashboard/maintenance/${id}`);
      }
    } catch (err: any) {
      setError(err.message ?? 'Failed to update maintenance record');
    } finally {
      setSaving(false);
    }
  };

  const isLoading = loadingLookups || loadingRecord;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Link href={`/dashboard/maintenance/${id}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="mr-2 h-4 w-4" />
        Back to Details
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Edit Maintenance Record</CardTitle>
          <CardDescription>Update details of the maintenance record.</CardDescription>
        </CardHeader>
        <CardContent>
          {lookupError && <div className="mb-4"><ErrorAlert message={lookupError} /></div>}
          {error && <div className="mb-4"><ErrorAlert message={error} /></div>}

          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2Icon className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Asset Dropdown */}
              <div className="space-y-2">
                <Label htmlFor="asset-select">Asset *</Label>
                <Select value={assetId} onValueChange={(val) => setAssetId(val || '')} required>
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

              {/* Maintenance Type */}
              <div className="space-y-2">
                <Label htmlFor="maintenance-type">Maintenance Type *</Label>
                <Select value={type} onValueChange={(val) => setType(val || '')} required>
                  <SelectTrigger id="maintenance-type">
                    <SelectValue placeholder="Select maintenance type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Preventive">Preventive</SelectItem>
                    <SelectItem value="Corrective">Corrective</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Vendor Dropdown */}
              <div className="space-y-2">
                <Label htmlFor="vendor-select">Vendor</Label>
                <Select value={vendorId} onValueChange={(val) => setVendorId(val || '')}>
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
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description / Issue *</Label>
                <Input
                  id="description"
                  placeholder="e.g. Routine oil change, screen replacement..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </div>

              {/* Cost & Performed By */}
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

              {/* Dates */}
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

              {/* Notes */}
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
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
                <Link href={`/dashboard/maintenance/${id}`}>
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
