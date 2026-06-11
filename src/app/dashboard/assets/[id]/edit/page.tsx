'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { updateAssetAction } from '@/app/actions/crud';
import { getCategories, type Category } from '@/lib/supabase/categories';
import { getVendors, type Vendor } from '@/lib/supabase/vendors';
import { getUsers, type User } from '@/lib/supabase/users';
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

export default function EditAssetPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [categories, setCategories] = useState<Category[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentStep, setCurrentStep] = useState(0);

  const [loading, setLoading] = useState(false);
  const [fetchingAsset, setFetchingAsset] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [categoryId, setCategoryId] = useState<string>('NONE');
  const [vendorId, setVendorId] = useState<string>('NONE');
  const [assignedEmployeeId, setAssignedEmployeeId] = useState<string>('NONE');
  const [cost, setCost] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [warrantyExpiry, setWarrantyExpiry] = useState('');
  const [status, setStatus] = useState<'Available' | 'Allocated' | 'Under Maintenance' | 'Retired'>('Available');
  const [notes, setNotes] = useState('');

  const assignedUser = users.find((u) => u.id === assignedEmployeeId);
  const selectedCategoryLabel = optionalNoneLabel(
    categoryId,
    categories.find((c) => c.id === categoryId)?.name,
    'Select Category'
  );
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
    async function loadData() {
      try {
        const [catsRes, vendsRes, usersRes, assetRes] = await Promise.all([
          getCategories({ page: 1, pageSize: 100 }),
          getVendors({ page: 1, pageSize: 100 }),
          getUsers({ page: 1, pageSize: 100 }),
          supabase.from('assets').select('*').eq('asset_tag', id).single(),
        ]);

        if (catsRes.error) throw catsRes.error;
        if (vendsRes.error) throw vendsRes.error;
        if (usersRes.error) throw usersRes.error;
        if (assetRes.error) throw assetRes.error;

        setCategories(catsRes.data);
        setVendors(vendsRes.data);
        setUsers(usersRes.data);

        const asset = assetRes.data;
        setName(asset.name || '');
        setSerialNumber(asset.serial_number || '');
        setCategoryId(asset.category_id || 'NONE');
        setVendorId(asset.vendor_id || 'NONE');
        setAssignedEmployeeId(asset.assigned_employee_id || 'NONE');
        setCost(asset.cost !== null && asset.cost !== undefined ? String(asset.cost) : '');
        setPurchaseDate(asset.purchase_date || '');
        setWarrantyExpiry(asset.warranty_expiry || '');
        setStatus(asset.status || 'Available');
        setNotes(asset.notes || '');
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load asset details or options');
      } finally {
        setFetchingAsset(false);
      }
    }

    if (id) loadData();
  }, [id]);

  const handleSubmit = async () => {
    if (!name) {
      setError('Name is required.');
      setCurrentStep(0);
      return;
    }

    setLoading(true);
    setError(null);

    const assetUpdates = {
      name,
      serial_number: serialNumber.trim() || null,
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
      const result = await updateAssetAction(id, assetUpdates);
      if (result.error) {
        setError(result.error);
      } else {
        router.push(`/dashboard/assets/${id}`);
        router.refresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update asset');
    } finally {
      setLoading(false);
    }
  };

  if (fetchingAsset) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <Loader2Icon className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading asset form...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        badge="Edit Asset"
        title={`Modify ${id}`}
        description="Update asset properties using the guided multi-step editor."
        actions={
          <Link href={`/dashboard/assets/${id}`}>
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
        submitLabel="Save Changes"
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
                  <p className="text-xs text-muted-foreground">Tag: <span className="font-mono text-primary">{id}</span></p>
                </div>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="name">Asset Name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="erp-dark-glass rounded-xl border text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                    required
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="serialNumber">Serial Number</Label>
                  <Input
                    id="serialNumber"
                    placeholder="Defaults to asset tag if empty"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    className="erp-dark-glass rounded-xl border text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                  />
                  <p className="text-xs text-muted-foreground">Updating this regenerates the QR code.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={categoryId} onValueChange={(val) => setCategoryId(val ?? 'NONE')}>
                    <SelectTrigger id="category" className="erp-dark-glass rounded-xl border text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                      <span className="truncate">{selectedCategoryLabel}</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">None</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
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
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    className="erp-dark-glass rounded-xl border text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  rows={3}
                  className="flex w-full erp-dark-glass rounded-xl border text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
                  <p className="text-xs text-muted-foreground">Allocation and operational status</p>
                </div>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="employee">Assigned To</Label>
                  <Select value={assignedEmployeeId} onValueChange={(val) => setAssignedEmployeeId(val ?? 'NONE')}>
                    <SelectTrigger id="employee" className="erp-dark-glass rounded-xl border text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                      <span className="truncate">{selectedEmployeeLabel}</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Unassigned</SelectItem>
                      {users.map((usr) => (
                        <SelectItem key={usr.id} value={usr.id}>
                          {usr.first_name} {usr.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={status} onValueChange={(val) => setStatus(val as typeof status)}>
                    <SelectTrigger id="status" className="erp-dark-glass rounded-xl border text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
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
                  <p className="text-xs text-muted-foreground">Purchase timeline and coverage</p>
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
                    className="erp-dark-glass rounded-xl border text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="warrantyExpiry">Warranty Expiry</Label>
                  <Input
                    id="warrantyExpiry"
                    type="date"
                    value={warrantyExpiry}
                    onChange={(e) => setWarrantyExpiry(e.target.value)}
                    className="erp-dark-glass rounded-xl border text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
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
                  <p className="text-xs text-muted-foreground">Supplier association</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor">Vendor</Label>
                <Select value={vendorId} onValueChange={(val) => setVendorId(val ?? 'NONE')}>
                  <SelectTrigger id="vendor" className="erp-dark-glass rounded-xl border text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <span className="truncate">{selectedVendorLabel}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">None</SelectItem>
                    {vendors.map((vend) => (
                      <SelectItem key={vend.id} value={vend.id}>{vend.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </GlassPanel>
      </StepForm>
    </div>
  );
}
