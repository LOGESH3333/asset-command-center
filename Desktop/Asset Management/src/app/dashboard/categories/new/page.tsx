'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createCategoryAction } from '@/app/actions/crud';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { ArrowLeftIcon, Loader2Icon } from 'lucide-react';

export default function NewCategoryPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Category name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await createCategoryAction(name.trim());
      if (result.error) {
        setError(result.error);
      } else {
        router.push('/dashboard/categories');
      }
    } catch (err: any) {
      setError(err.message ?? 'Failed to create category');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link href="/dashboard/categories" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="mr-2 h-4 w-4" />
        Back to Categories
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Add New Category</CardTitle>
          <CardDescription>Create a new asset category.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && <div className="mb-4"><ErrorAlert message={error} /></div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">Category Name</Label>
              <Input
                id="category-name"
                placeholder="e.g. Laptops, Monitors, Furniture..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={saving}>
                {saving && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
                Create Category
              </Button>
              <Link href="/dashboard/categories">
                <Button variant="outline" type="button">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
