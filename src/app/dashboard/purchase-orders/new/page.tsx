'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createPurchaseOrderAction } from '@/app/actions/brd/purchase-orders';
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

export default function NewPurchaseOrderPage() {
  return (
    <BrdRoleGate allowed={['Admin']}>
      <NewPurchaseOrderForm />
    </BrdRoleGate>
  );
}

function NewPurchaseOrderForm() {
  const router = useRouter();
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [procurements, setProcurements] = useState<{ id: string; title: string; status: string }[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(true);
  const [poNumber, setPoNumber] = useState('');
  const [procurementId, setProcurementId] = useState('NONE');
  const [vendorId, setVendorId] = useState('NONE');
  const [totalAmount, setTotalAmount] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [expectedDelivery, setExpectedDelivery] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProcurementLabel = optionalNoneLabel(
    procurementId,
    procurements.find((p) => p.id === procurementId)?.title,
    'Optional procurement'
  );
  const selectedVendorLabel = optionalNoneLabel(
    vendorId,
    vendors.find((v) => v.id === vendorId)?.name,
    'Optional vendor'
  );

  useEffect(() => {
    Promise.all([getBrdFormLookupsAction(), listVendorOptionsAction()]).then(([lookups, vendorResult]) => {
      setVendors(vendorResult.data ?? lookups.vendors ?? []);
      setProcurements(lookups.procurements ?? []);
      const lookupError = [lookups.error, vendorResult.error].filter(Boolean).join('; ');
      if (lookupError) setError(lookupError);
      setLoadingLookups(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poNumber.trim()) { setError('PO number is required.'); return; }
    setSaving(true);
    const result = await createPurchaseOrderAction({
      po_number: poNumber.trim(),
      procurement_id: procurementId !== 'NONE' ? procurementId : null,
      vendor_id: vendorId !== 'NONE' ? vendorId : null,
      total_amount: totalAmount ? parseFloat(totalAmount) : null,
      order_date: orderDate || null,
      expected_delivery: expectedDelivery || null,
      notes: notes || null,
    });
    if (result.error) setError(result.error);
    else router.push('/dashboard/purchase-orders');
    setSaving(false);
  };

  if (loadingLookups) return <Skeleton className="h-64 w-full rounded-xl" />;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link href="/dashboard/purchase-orders" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="mr-2 h-4 w-4" />Back to Purchase Orders
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>New Purchase Order</CardTitle>
          <CardDescription>Create a purchase order.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && <div className="mb-4"><ErrorAlert message={error} /></div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>PO Number *</Label>
              <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="PO-2024-001" required />
            </div>
            <div className="space-y-2">
              <Label>Procurement</Label>
              <Select value={procurementId} onValueChange={(v) => setProcurementId(v ?? 'NONE')}>
                <SelectTrigger><span className="truncate">{selectedProcurementLabel}</span></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None</SelectItem>
                  {procurements.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
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
              <Label>Total Amount ($)</Label>
              <Input type="number" step="0.01" min="0" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Order Date</Label>
                <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Expected Delivery</Label>
                <Input type="date" value={expectedDelivery} onChange={(e) => setExpectedDelivery(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
            </div>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}Create Purchase Order
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
