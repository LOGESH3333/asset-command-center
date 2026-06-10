'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createAssetAction, getFormOptionsAction } from '@/app/actions/crud';
import type { Category } from '@/lib/supabase/categories';
import type { Vendor } from '@/lib/supabase/vendors';
import type { User } from '@/lib/supabase/users';

type CategoryOption = Pick<Category, 'id' | 'name'>;
type VendorOption = Pick<Vendor, 'id' | 'name'>;
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { PageHeader } from '@/components/enterprise/page-header';
import { GlassPanel } from '@/components/enterprise/glass-panel';
import { StepForm } from '@/components/enterprise/step-form';
import {
  ChevronLeftIcon,
  Loader2Icon,
  Package,
  UserCircle,
  Shield,
  Store,
} from 'lucide-react';
import { formatPersonName, optionalNoneLabel } from '@/lib/display-labels';

const STEPS = [
  { id: 'asset', title: 'Asset Info', description: 'Identity & classification' },
  { id: 'assignment', title: 'Assignment', description: 'Allocation & status' },
  { id: 'warranty', title: 'Warranty', description: 'Purchase & coverage' },
  { id: 'vendor', title: 'Vendor', description: 'Supplier details' },
];

export default function NewAssetPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentStep, setCurrentStep] = useState(0);

  const [loading, setLoading] = useState(false);
  const [fetchingOptions, setFetchingOptions] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [assetTag, setAssetTag] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<string>('NONE');
  const [vendorId, setVendorId] = useState<string>('NONE');
  const [assignedEmployeeId, setAssignedEmployeeId] = useState<string>('NONE');
  const [cost, setCost] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [warrantyExpiry, setWarrantyExpiry] = useState('');
  const [status, setStatus] = useState<'Available' | 'Allocated' | 'Under Maintenance' | 'Retired'>('Available');
  const [notes, setNotes] = useState('');

  const selectedCategoryLabel = optionalNoneLabel(
    categoryId,
    categories.find((c) => c.id === categoryId)?.name,
    'Select Category'
  );
  const assignedUser = users.find((u) => u.id === assignedEmployeeId);
  const selectedEmployeeLabel = optionalNoneLabel(
    assignedEmployeeId,
    assignedUser ? formatPersonName(assignedUser) : undefined,
    'Unassigned'
  );
  const selectedVendorLabel = optionalNoneLabel(
    vendorId,
    vendors.find((v) => v.id === vendorId)?.name,
    'Select Vendor'
  );

  useEffect(() => {
    async function loadOptions() {
      try {
        const result = await getFormOptionsAction();
        if (result.error) throw new Error(result.error);
        setCategories(result.data?.categories ?? []);
        setVendors(result.data?.vendors ?? []);
        setUsers((result.data?.users ?? []) as User[]);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load options for dropdowns');
      } finally {
        setFetchingOptions(false);
      }
    }
    loadOptions();
  }, []);

  const handleSubmit = async () => {
    if (!assetTag || !name) {
      setError('Asset Tag and Name are required.');
      setCurrentStep(0);
      return;
    }

    setLoading(true);
    setError(null);

    const assetData = {
      asset_tag: assetTag,
      serial_number: serialNumber.trim() || null,
      name,
      category_id: categoryId === 'NONE' ? null : categoryId,
      vendor_id: vendorId === 'NONE' ? null : vendorId,
      assigned_employee_id: assignedEmployeeId === 'NONE' ? null : assignedEmployeeId,
      cost: cost ? parseFloat(cost) : null,
      purchase_date: purchaseDate || null,
      warranty_expiry: warrantyExpiry || null,
      status,
      notes: notes || null,
    };

    try {
      const result = await createAssetAction(assetData);
      if (result.error) {
        setError(result.error);
      } else {
        router.push('/dashboard/assets');
        router.refresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create asset');
    } finally {
      setLoading(false);
    }
  };

  if (fetchingOptions) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <Loader2Icon className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading form options...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        badge="New Asset"
        title="Register Asset"
        description="Add a new asset to your enterprise inventory with guided multi-step registration."
        actions={
          <Link href="/dashboard/assets">
            <Button variant="ghost" size="sm" className="rounded-xl">
              <ChevronLeftIcon className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
        }
      />

      {error && <ErrorAlert message={error} />}

      <StepForm
        steps={STEPS}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
        onSubmit={handleSubmit}
        submitting={loading}
        submitLabel="Register Asset"
      >
        <GlassPanel className="p-6">
          {currentStep === 0 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b border-glass-border pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Asset Information</h3>
                  <p className="text-xs text-muted-foreground">Core identity and classification</p>
                </div>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="assetTag">Asset Tag *</Label>
                  <Input
                    id="assetTag"
                    placeholder="e.g. AST-1004"
                    value={assetTag}
                    onChange={(e) => setAssetTag(e.target.value)}
                    className="rounded-xl border-0 bg-muted/40"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serialNumber">Serial Number</Label>
                  <Input
                    id="serialNumber"
                    placeholder="Defaults to asset tag if empty"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    className="rounded-xl border-0 bg-muted/40"
                  />
                  <p className="text-xs text-muted-foreground">Encoded in the asset QR label.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Asset Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g. MacBook Pro M3"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="rounded-xl border-0 bg-muted/40"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={categoryId} onValueChange={(val) => setCategoryId(val ?? 'NONE')}>
                    <SelectTrigger id="category" className="rounded-xl border-0 bg-muted/40">
                      <span className="truncate">{selectedCategoryLabel}</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">None</SelectItem>
                      {categories.length === 0 ? (
                        <SelectItem value="__empty__" disabled>
                          No categories — run Seed Demo Data in Settings
                        </SelectItem>
                      ) : (
                        categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cost">Acquisition Cost ($)</Label>
                  <Input
                    id="cost"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 1299.99"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    className="rounded-xl border-0 bg-muted/40"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  rows={3}
                  className="flex w-full rounded-xl border-0 bg-muted/40 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Serial numbers, configuration, location..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b border-glass-border pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
                  <UserCircle className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-semibold">Assignment Information</h3>
                  <p className="text-xs text-muted-foreground">Who owns this asset and its current state</p>
                </div>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="employee">Assigned To</Label>
                  <Select value={assignedEmployeeId} onValueChange={(val) => setAssignedEmployeeId(val ?? 'NONE')}>
                    <SelectTrigger id="employee" className="rounded-xl border-0 bg-muted/40">
                      <span className="truncate">{selectedEmployeeLabel}</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Unassigned</SelectItem>
                      {users.length === 0 ? (
                        <SelectItem value="__empty__" disabled>
                          No users — run Seed Demo Data in Settings
                        </SelectItem>
                      ) : (
                        users.map((usr) => (
                          <SelectItem key={usr.id} value={usr.id}>
                            {usr.first_name} {usr.last_name} ({usr.department || 'No Dept'})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={status} onValueChange={(val) => setStatus(val as typeof status)}>
                    <SelectTrigger id="status" className="rounded-xl border-0 bg-muted/40">
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Available">Available</SelectItem>
                      <SelectItem value="Allocated">Allocated</SelectItem>
                      <SelectItem value="Under Maintenance">Under Maintenance</SelectItem>
                      <SelectItem value="Retired">Retired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b border-glass-border pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                  <Shield className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-semibold">Warranty Information</h3>
                  <p className="text-xs text-muted-foreground">Purchase timeline and coverage dates</p>
                </div>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="purchaseDate">Purchase Date</Label>
                  <Input
                    id="purchaseDate"
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="rounded-xl border-0 bg-muted/40"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="warrantyExpiry">Warranty Expiry</Label>
                  <Input
                    id="warrantyExpiry"
                    type="date"
                    value={warrantyExpiry}
                    onChange={(e) => setWarrantyExpiry(e.target.value)}
                    className="rounded-xl border-0 bg-muted/40"
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b border-glass-border pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                  <Store className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <h3 className="font-semibold">Vendor Information</h3>
                  <p className="text-xs text-muted-foreground">Link this asset to its supplier</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor">Vendor</Label>
                <Select value={vendorId} onValueChange={(val) => setVendorId(val ?? 'NONE')}>
                  <SelectTrigger id="vendor" className="rounded-xl border-0 bg-muted/40">
                    <span className="truncate">{selectedVendorLabel}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">None</SelectItem>
                    {vendors.length === 0 ? (
                      <SelectItem value="__empty__" disabled>
                        No vendors — run Seed Demo Data in Settings
                      </SelectItem>
                    ) : (
                      vendors.map((vend) => (
                        <SelectItem key={vend.id} value={vend.id}>
                          {vend.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-xl border border-glass-border bg-muted/20 p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Review summary</p>
                <ul className="mt-2 space-y-1 text-xs">
                  <li>Tag: <span className="font-mono text-primary">{assetTag || '—'}</span></li>
                  <li>Name: {name || '—'}</li>
                  <li>Status: {status}</li>
                  {cost && <li>Cost: ${parseFloat(cost).toLocaleString()}</li>}
                </ul>
              </div>
            </div>
          )}
        </GlassPanel>
      </StepForm>
    </div>
  );
}
