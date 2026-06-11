'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getInventoryItemAction, updateInventoryAction } from '@/app/actions/brd/inventory';
import { getBrdFormLookupsAction } from '@/app/actions/brd/lookups';
import { BrdRoleGate } from '@/components/brd/role-gate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { SuccessToast } from '@/components/common/SuccessToast';
import { Skeleton } from '@/components/common/Skeleton';
import { ArrowLeftIcon, Loader2Icon, AlertTriangleIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { optionalNoneLabel } from '@/lib/display-labels';

export default function InventoryDetailPage() {
  return (
    <BrdRoleGate allowed={['Admin']}>
      <InventoryEditForm />
    </BrdRoleGate>
  );
}

function InventoryEditForm() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState('NONE');
  const [vendorId, setVendorId] = useState('NONE');
  const [quantity, setQuantity] = useState('0');
  const [reorderLevel, setReorderLevel] = useState('0');
  const [unitCost, setUnitCost] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    Promise.all([getInventoryItemAction(id), getBrdFormLookupsAction()]).then(([itemResult, lookups]) => {
      if (itemResult.error || !itemResult.data) {
        setNotFound(true);
        if (itemResult.error) setError(itemResult.error);
      } else {
        const item = itemResult.data;
        setName(item.name);
        setSku(item.sku ?? '');
        setCategoryId(item.category_id ?? 'NONE');
        setVendorId(item.vendor_id ?? 'NONE');
        setQuantity(String(item.quantity_on_hand));
        setReorderLevel(String(item.reorder_level));
        setUnitCost(item.unit_cost != null ? String(item.unit_cost) : '');
        setLocation(item.location ?? '');
        setNotes(item.notes ?? '');
      }
      setVendors(lookups.vendors ?? []);
      setCategories(lookups.categories ?? []);
      setLoading(false);
    });
  }, [id]);

  const selectedCategoryLabel = optionalNoneLabel(
    categoryId,
    categories.find((c) => c.id === categoryId)?.name,
    'None'
  );
  const selectedVendorLabel = optionalNoneLabel(
    vendorId,
    vendors.find((v) => v.id === vendorId)?.name,
    'None'
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    const result = await updateInventoryAction(id, {
      name: name.trim(),
      sku: sku || null,
      category_id: categoryId !== 'NONE' ? categoryId : null,
      vendor_id: vendorId !== 'NONE' ? vendorId : null,
      quantity_on_hand: parseInt(quantity, 10) || 0,
      reorder_level: parseInt(reorderLevel, 10) || 0,
      unit_cost: unitCost ? parseFloat(unitCost) : null,
      location: location || null,
      notes: notes || null,
    });
    if (result.error) setError(result.error);
    else {
      setToast('Inventory item updated.');
      setTimeout(() => router.push('/dashboard/inventory'), 800);
    }
    setSaving(false);
  };

  const qty = parseInt(quantity, 10) || 0;
  const reorder = parseInt(reorderLevel, 10) || 0;
  const isLow = qty <= reorder;

  if (loading) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (notFound) return <ErrorAlert message={error || 'Not found'} />;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      {toast && <SuccessToast message={toast} onDismiss={() => setToast(null)} />}
      <Link href="/dashboard/inventory" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="mr-2 h-4 w-4" />Back to Inventory
      </Link>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Edit Inventory Item
            {isLow && <AlertTriangleIcon className="h-5 w-5 text-amber-500" />}
          </CardTitle>
          <CardDescription className={cn(isLow && 'text-amber-700 dark:text-amber-400')}>
            {isLow ? 'This item is at or below reorder level.' : 'Update stock and item details.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && <div className="mb-4"><ErrorAlert message={error} /></div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>SKU</Label>
              <Input value={sku} onChange={(e) => setSku(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? 'NONE')}>
                <SelectTrigger><span className="truncate">{selectedCategoryLabel}</span></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None</SelectItem>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Quantity on Hand</Label>
                <Input type="number" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Reorder Level</Label>
                <Input type="number" min="0" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Unit Cost ($)</Label>
              <Input type="number" step="0.01" min="0" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
