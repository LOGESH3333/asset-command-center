'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createInventoryAction } from '@/app/actions/brd/inventory';
import { getBrdFormLookupsAction } from '@/app/actions/brd/lookups';
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

export default function NewInventoryPage() {
  return (
    <BrdRoleGate allowed={['Admin', 'Manager']}>
      <NewInventoryForm />
    </BrdRoleGate>
  );
}

function NewInventoryForm() {
  const router = useRouter();
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(true);
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

  const selectedCategoryLabel = optionalNoneLabel(
    categoryId,
    categories.find((c) => c.id === categoryId)?.name,
    'Optional category'
  );
  const selectedVendorLabel = optionalNoneLabel(
    vendorId,
    vendors.find((v) => v.id === vendorId)?.name,
    'Optional vendor'
  );

  useEffect(() => {
    getBrdFormLookupsAction().then((r) => {
      setVendors(r.vendors ?? []);
      setCategories(r.categories ?? []);
      if (r.error) setError(r.error);
      setLoadingLookups(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    const result = await createInventoryAction({
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
    else router.push('/dashboard/inventory');
    setSaving(false);
  };

  if (loadingLookups) return <Skeleton className="h-64 w-full rounded-xl" />;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link href="/dashboard/inventory" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="mr-2 h-4 w-4" />Back to Inventory
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>New Inventory Item</CardTitle>
          <CardDescription>Add a consumable or spare part to inventory.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && <div className="mb-4"><ErrorAlert message={error} /></div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Item name" required />
            </div>
            <div className="space-y-2">
              <Label>SKU</Label>
              <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Optional SKU" />
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
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Storage location" />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
            </div>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}Create Item
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
