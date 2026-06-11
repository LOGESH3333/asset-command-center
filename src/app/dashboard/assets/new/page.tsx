'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  checkAssetTagAction,
  createAssetAction,
  getAssetRegistrationDefaultsAction,
  getFormOptionsAction,
} from '@/app/actions/crud';
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
import { formatUserFacingDbError } from '@/lib/supabase/audit-db-errors';
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
import { formatRequestLabel } from '@/lib/supabase/requests';
import { cn } from '@/lib/utils';

const FORM_LABEL = 'text-sm font-medium text-zinc-200';
const FORM_HELPER = 'text-xs leading-relaxed text-zinc-400';
const FORM_FIELD =
  'erp-dark-glass rounded-xl border border-white/[0.08] bg-white/[0.03] text-zinc-100 placeholder:text-zinc-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] focus-visible:border-violet-500/35 focus-visible:ring-2 focus-visible:ring-violet-500/15';
const SECTION_TITLE = 'text-base font-semibold tracking-tight text-zinc-100';
const SECTION_DESC = 'text-xs leading-relaxed text-zinc-400';
const STEP_ICON_WRAP = 'flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]';

function FormHint({ children }: { children: React.ReactNode }) {
  return <p className={FORM_HELPER}>{children}</p>;
}

const STEPS = [
  { id: 'asset', title: 'Asset Info', description: 'Identity & classification' },
  { id: 'assignment', title: 'Assignment', description: 'Allocation & status' },
  { id: 'warranty', title: 'Warranty', description: 'Purchase & coverage' },
  { id: 'vendor', title: 'Vendor', description: 'Supplier details' },
];

type RequestOption = { id: string; justification: string; status: string; requester_id: string | null };

export default function NewAssetPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRequestId = searchParams.get('requestId');
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [requests, setRequests] = useState<RequestOption[]>([]);
  const [currentStep, setCurrentStep] = useState(0);

  const [loading, setLoading] = useState(false);
  const [fetchingOptions, setFetchingOptions] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [assetTag, setAssetTag] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<string>('NONE');
  const [vendorId, setVendorId] = useState<string>('NONE');
  const [requestId, setRequestId] = useState<string>(initialRequestId ?? 'NONE');
  const [assignedEmployeeId, setAssignedEmployeeId] = useState<string>('NONE');
  const [cost, setCost] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [warrantyExpiry, setWarrantyExpiry] = useState('');
  const [status, setStatus] = useState<'Available' | 'Allocated' | 'Under Maintenance' | 'Retired'>('Available');
  const [notes, setNotes] = useState('');
  const [tagHint, setTagHint] = useState<string | null>(null);
  const [resumedMessage, setResumedMessage] = useState<string | null>(null);
  const [existingAssetTag, setExistingAssetTag] = useState<string | null>(null);

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
        const [optionsResult, defaultsResult] = await Promise.all([
          getFormOptionsAction(),
          getAssetRegistrationDefaultsAction(initialRequestId),
        ]);
        if (optionsResult.error) throw new Error(optionsResult.error);
        setCategories(optionsResult.data?.categories ?? []);
        setVendors(optionsResult.data?.vendors ?? []);
        setUsers((optionsResult.data?.users ?? []) as User[]);
        const loadedRequests = optionsResult.data?.requests ?? [];
        setRequests(loadedRequests);

        if (defaultsResult.data?.suggested_asset_tag && !assetTag) {
          setAssetTag(defaultsResult.data.suggested_asset_tag);
        }
        if (defaultsResult.data?.suggested_name && !name) {
          setName(defaultsResult.data.suggested_name);
        }
        if (defaultsResult.data?.existing_asset_tag) {
          setExistingAssetTag(defaultsResult.data.existing_asset_tag);
          setResumedMessage(
            `Request already has asset ${defaultsResult.data.existing_asset_tag}. Submitting again will finalize registration (QR / allocation) without creating a duplicate.`
          );
          setAssetTag(defaultsResult.data.existing_asset_tag);
        }

        if (initialRequestId) {
          const linked = loadedRequests.find((r) => r.id === initialRequestId);
          if (linked?.requester_id) {
            setAssignedEmployeeId(linked.requester_id);
          }
        }
      } catch (err: unknown) {
        setError(
          formatUserFacingDbError(
            err instanceof Error ? err.message : 'Failed to load options for dropdowns'
          )
        );
      } finally {
        setFetchingOptions(false);
      }
    }
    loadOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  useEffect(() => {
    const trimmed = assetTag.trim();
    if (!trimmed || trimmed.length < 3) {
      setTagHint(null);
      return;
    }

    const timer = setTimeout(async () => {
      if (existingAssetTag && trimmed.toUpperCase() === existingAssetTag.toUpperCase()) {
        setTagHint(null);
        return;
      }
      const result = await checkAssetTagAction(trimmed);
      if (result.data?.available === false) {
        setTagHint(
          result.data.suggested_asset_tag
            ? `Tag "${trimmed.toUpperCase()}" is taken. Suggested: ${result.data.suggested_asset_tag}`
            : (result.data.message ?? 'This asset tag is already in use.')
        );
      } else {
        setTagHint(null);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [assetTag, existingAssetTag]);

  const handleSubmit = async () => {
    if (!assetTag || !name) {
      setError('Asset Tag and Name are required.');
      setCurrentStep(0);
      return;
    }

    setLoading(true);
    setError(null);

    const normalizedTag = assetTag.trim().toUpperCase();
    if (!normalizedTag) {
      setError('Asset Tag is required.');
      setCurrentStep(0);
      setLoading(false);
      return;
    }

    const isResumingExisting =
      existingAssetTag != null && normalizedTag === existingAssetTag.toUpperCase();
    if (!isResumingExisting) {
      const tagCheck = await checkAssetTagAction(normalizedTag);
      if (tagCheck.data?.available === false) {
        setError(tagCheck.data.message ?? 'This asset tag is already registered.');
        setCurrentStep(0);
        setLoading(false);
        return;
      }
    }

    const assetData = {
      asset_tag: normalizedTag,
      serial_number: serialNumber.trim() || null,
      name,
      category_id: categoryId === 'NONE' ? null : categoryId,
      vendor_id: vendorId === 'NONE' ? null : vendorId,
      request_id: requestId === 'NONE' ? null : requestId,
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
        if (result.error.toLowerCase().includes('already registered')) {
          setCurrentStep(0);
        }
      } else {
        router.push('/dashboard/assets');
        router.refresh();
      }
    } catch (err: unknown) {
      setError(
        formatUserFacingDbError(err instanceof Error ? err.message : 'Failed to create asset')
      );
    } finally {
      setLoading(false);
    }
  };

  if (fetchingOptions) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <Loader2Icon className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-zinc-400">Loading form options...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-7 pb-4">
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

      {resumedMessage && !error && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {resumedMessage}
        </div>
      )}

      {error && (
        <ErrorAlert
          variant="compact"
          title="Unable to register asset"
          message={error}
        />
      )}

      <StepForm
        steps={STEPS}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
        onSubmit={handleSubmit}
        submitting={loading}
        submitLabel="Register Asset"
      >
        <GlassPanel className="p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:p-8">
          {currentStep === 0 && (
            <div className="space-y-7">
              <div className="flex items-center gap-4 border-b border-white/[0.08] pb-5">
                <div className={cn(STEP_ICON_WRAP, 'bg-violet-500/10')}>
                  <Package className="h-5 w-5 text-violet-400" />
                </div>
                <div>
                  <h3 className={SECTION_TITLE}>Asset Information</h3>
                  <p className={SECTION_DESC}>Core identity and classification</p>
                </div>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2.5">
                  <Label htmlFor="assetTag" className={FORM_LABEL}>Asset Tag *</Label>
                  <Input
                    id="assetTag"
                    placeholder="e.g. AST-1004"
                    value={assetTag}
                    onChange={(e) => setAssetTag(e.target.value.toUpperCase())}
                    className={FORM_FIELD}
                    required
                  />
                  {tagHint ? <p className="text-xs text-amber-300/90">{tagHint}</p> : null}
                  <FormHint>Auto-suggested unique tag on load. Must be unique across all assets.</FormHint>
                </div>
                <div className="space-y-2.5">
                  <Label htmlFor="serialNumber" className={FORM_LABEL}>Serial Number</Label>
                  <Input
                    id="serialNumber"
                    placeholder="Defaults to asset tag if empty"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    className={FORM_FIELD}
                  />
                  <FormHint>Encoded in the asset QR label.</FormHint>
                </div>
                <div className="space-y-2.5">
                  <Label htmlFor="name" className={FORM_LABEL}>Asset Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g. MacBook Pro M3"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={FORM_FIELD}
                    required
                  />
                </div>
                <div className="space-y-2.5">
                  <Label htmlFor="category" className={FORM_LABEL}>Category</Label>
                  <Select value={categoryId} onValueChange={(val) => setCategoryId(val ?? 'NONE')}>
                    <SelectTrigger id="category" className={FORM_FIELD}>
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
                <div className="space-y-2.5">
                  <Label htmlFor="cost" className={FORM_LABEL}>Acquisition Cost ($)</Label>
                  <Input
                    id="cost"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 1299.99"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    className={FORM_FIELD}
                  />
                </div>
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="notes" className={FORM_LABEL}>Notes</Label>
                <textarea
                  id="notes"
                  rows={3}
                  className={cn(
                    'flex w-full px-3 py-2.5 text-sm focus-visible:outline-none',
                    FORM_FIELD
                  )}
                  placeholder="Serial numbers, configuration, location..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-7">
              <div className="flex items-center gap-4 border-b border-white/[0.08] pb-5">
                <div className={cn(STEP_ICON_WRAP, 'bg-blue-500/10')}>
                  <UserCircle className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <h3 className={SECTION_TITLE}>Assignment Information</h3>
                  <p className={SECTION_DESC}>Who owns this asset and its current state</p>
                </div>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                {requests.length > 0 ? (
                  <div className="space-y-2.5 md:col-span-2">
                    <Label htmlFor="request" className={FORM_LABEL}>Linked Request (optional)</Label>
                    <Select
                      value={requestId}
                      onValueChange={(val) => {
                        const next = val ?? 'NONE';
                        setRequestId(next);
                        const linked = requests.find((r) => r.id === next);
                        if (linked?.requester_id) {
                          setAssignedEmployeeId(linked.requester_id);
                        }
                      }}
                    >
                      <SelectTrigger id="request" className={FORM_FIELD}>
                        <span className="truncate">
                          {requestId === 'NONE'
                            ? 'No linked request'
                            : formatRequestLabel(requests.find((r) => r.id === requestId)?.justification)}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE">No linked request</SelectItem>
                        {requests.map((req) => (
                          <SelectItem key={req.id} value={req.id}>
                            {formatRequestLabel(req.justification)} ({req.status})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                <div className="space-y-2.5">
                  <Label htmlFor="employee" className={FORM_LABEL}>Assigned To</Label>
                  <Select value={assignedEmployeeId} onValueChange={(val) => setAssignedEmployeeId(val ?? 'NONE')}>
                    <SelectTrigger id="employee" className={FORM_FIELD}>
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
                <div className="space-y-2.5">
                  <Label htmlFor="status" className={FORM_LABEL}>Status</Label>
                  <Select value={status} onValueChange={(val) => setStatus(val as typeof status)}>
                    <SelectTrigger id="status" className={FORM_FIELD}>
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
            <div className="space-y-7">
              <div className="flex items-center gap-4 border-b border-white/[0.08] pb-5">
                <div className={cn(STEP_ICON_WRAP, 'bg-amber-500/10')}>
                  <Shield className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <h3 className={SECTION_TITLE}>Warranty Information</h3>
                  <p className={SECTION_DESC}>Purchase timeline and coverage dates</p>
                </div>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2.5">
                  <Label htmlFor="purchaseDate" className={FORM_LABEL}>Purchase Date</Label>
                  <Input
                    id="purchaseDate"
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className={FORM_FIELD}
                  />
                </div>
                <div className="space-y-2.5">
                  <Label htmlFor="warrantyExpiry" className={FORM_LABEL}>Warranty Expiry</Label>
                  <Input
                    id="warrantyExpiry"
                    type="date"
                    value={warrantyExpiry}
                    onChange={(e) => setWarrantyExpiry(e.target.value)}
                    className={FORM_FIELD}
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-7">
              <div className="flex items-center gap-4 border-b border-white/[0.08] pb-5">
                <div className={cn(STEP_ICON_WRAP, 'bg-emerald-500/10')}>
                  <Store className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className={SECTION_TITLE}>Vendor Information</h3>
                  <p className={SECTION_DESC}>Link this asset to its supplier</p>
                </div>
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="vendor" className={FORM_LABEL}>Vendor</Label>
                <Select value={vendorId} onValueChange={(val) => setVendorId(val ?? 'NONE')}>
                  <SelectTrigger id="vendor" className={FORM_FIELD}>
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
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <p className="text-sm font-semibold text-zinc-200">Review summary</p>
                <ul className="mt-3 space-y-2 text-sm text-zinc-400">
                  <li>
                    Tag:{' '}
                    <span className="font-mono text-violet-300">{assetTag || '—'}</span>
                  </li>
                  <li>
                    Name: <span className="text-zinc-200">{name || '—'}</span>
                  </li>
                  <li>
                    Status: <span className="text-zinc-200">{status}</span>
                  </li>
                  {cost && (
                    <li>
                      Cost: <span className="text-zinc-200">${parseFloat(cost).toLocaleString()}</span>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          )}
        </GlassPanel>
      </StepForm>
    </div>
  );
}
