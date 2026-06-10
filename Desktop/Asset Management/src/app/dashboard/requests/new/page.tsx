'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createRequestAction } from '@/app/actions/crud';
import { getBrdFormLookupsAction } from '@/app/actions/brd/lookups';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { Skeleton } from '@/components/common/Skeleton';
import { ArrowLeftIcon, Loader2Icon } from 'lucide-react';

export default function NewRequestPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(true);
  const [itemName, setItemName] = useState('');
  const [justification, setJustification] = useState('');
  const [categoryId, setCategoryId] = useState('NONE');
  const [priority, setPriority] = useState('Medium');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBrdFormLookupsAction().then((r) => {
      setCategories(r.categories ?? []);
      if (r.error) setError(r.error);
      setLoadingLookups(false);
    });
  }, []);

  const buildJustification = () => {
    const item = itemName.trim();
    const reason = justification.trim();
    if (item && reason) return `${item} — ${reason}`;
    return item || reason;
  };

  const selectedCategoryName =
    categoryId === 'NONE'
      ? 'None'
      : categories.find((category) => category.id === categoryId)?.name;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const combined = buildJustification();
    if (!combined) {
      setError('Provide an item name or business justification.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await createRequestAction({
        justification: combined,
        priority,
        category_id: categoryId !== 'NONE' ? categoryId : null,
      });
      if (result.error) {
        setError(result.error);
      } else {
        router.push('/dashboard/requests');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create request');
    } finally {
      setSaving(false);
    }
  };

  if (loadingLookups) {
    return <Skeleton className="h-64 w-full rounded-xl" />;
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link href="/dashboard/requests" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="mr-2 h-4 w-4" />
        Back to Requests
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Submit Asset Request</CardTitle>
          <CardDescription>Request a new asset or equipment.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && <div className="mb-4"><ErrorAlert message={error} /></div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="request-item">Item / Asset Needed</Label>
              <Input
                id="request-item"
                placeholder="e.g. MacBook Pro M3, Ergonomic Chair..."
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="request-justification">Business Justification *</Label>
              <textarea
                id="request-justification"
                placeholder="Why do you need this? Include role, project, or operational impact."
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                rows={4}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="request-category">Category</Label>
              <Select value={categoryId} onValueChange={(val) => setCategoryId(val ?? 'NONE')}>
                <SelectTrigger id="request-category">
                  <span className="truncate">{selectedCategoryName ?? 'Select category (optional)'}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="request-priority">Priority</Label>
              <Select value={priority} onValueChange={(val) => setPriority(val ?? 'Medium')}>
                <SelectTrigger id="request-priority">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving}>
                {saving && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
                Submit Request
              </Button>
              <Link href="/dashboard/requests">
                <Button variant="outline" type="button">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
