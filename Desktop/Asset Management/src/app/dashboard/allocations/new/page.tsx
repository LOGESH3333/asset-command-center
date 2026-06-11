'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  createAllocationAction,
  getAllocationFormLookupsAction,
} from '@/app/actions/brd/allocations';
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
import { formatAssetLabel, formatPersonName, labelFromOptions } from '@/lib/display-labels';

type AssetOption = { id: string; name: string; asset_tag: string; status: string };
type UserOption = { id: string; first_name: string; last_name: string; department: string | null; email?: string | null };

export default function NewAllocationPage() {
  return (
    <BrdRoleGate allowed={['Admin', 'Manager']}>
      <NewAllocationForm />
    </BrdRoleGate>
  );
}

function NewAllocationForm() {
  const router = useRouter();
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(true);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedAssetLabel = labelFromOptions(assets, assetId, formatAssetLabel, 'Select asset');
  const selectedEmployeeLabel = labelFromOptions(users, userId, (u) => formatPersonName(u), 'Select employee');

  useEffect(() => {
    getAllocationFormLookupsAction().then((r) => {
      setAssets(r.assets ?? []);
      setUsers(r.users ?? []);
      if (r.error) setError(r.error);
      setLoadingLookups(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!assetId) {
      setError('Please select an asset from the dropdown.');
      return;
    }
    if (!userId) {
      setError('Please select an employee from the dropdown.');
      return;
    }

    setSaving(true);
    try {
      const result = await createAllocationAction({
        asset_id: assetId,
        user_id: userId,
        notes,
      });
      if (result.error) {
        setError(result.error);
      } else {
        router.push('/dashboard/allocations');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loadingLookups) return <Skeleton className="h-64 w-full rounded-xl" />;

  if (assets.length === 0) {
    return (
      <EmptyState
        title="No available assets"
        description="All assets are currently allocated or under maintenance. Return an asset or register a new one before creating an allocation."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/dashboard/allocations">
              <Button variant="outline">View Allocations</Button>
            </Link>
            <Link href="/dashboard/assets/new">
              <Button>Register Asset</Button>
            </Link>
          </div>
        }
      />
    );
  }

  if (users.length === 0) {
    return (
      <EmptyState
        title="No employees found"
        description="Add users before assigning assets."
        action={
          <Link href="/dashboard/users">
            <Button>Manage Users</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link
        href="/dashboard/allocations"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="mr-2 h-4 w-4" />
        Back to Allocations
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>New Asset Allocation</CardTitle>
          <CardDescription>Assign an available asset to an employee.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4">
              <ErrorAlert message={error} />
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            <div className="space-y-2">
              <Label htmlFor="allocation-asset">Asset *</Label>
              <Select
                value={assetId}
                onValueChange={(v) => {
                  setAssetId(v);
                  setError(null);
                }}
              >
                <SelectTrigger id="allocation-asset" className="w-full">
                  <span className="truncate">{selectedAssetLabel}</span>
                </SelectTrigger>
                <SelectContent>
                  {assets.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} ({a.asset_tag})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Only assets with status &quot;Available&quot; are listed ({assets.length}).
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="allocation-employee">Employee *</Label>
              <Select
                value={userId}
                onValueChange={(v) => {
                  setUserId(v);
                  setError(null);
                }}
              >
                <SelectTrigger id="allocation-employee" className="w-full">
                  <span className="truncate">{selectedEmployeeLabel}</span>
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {formatPersonName(u)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="allocation-notes">Notes</Label>
              <Input
                id="allocation-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
              />
            </div>
            <Button type="submit" disabled={saving || !assetId || !userId} className="w-full sm:w-auto">
              {saving && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
              Create Allocation
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
