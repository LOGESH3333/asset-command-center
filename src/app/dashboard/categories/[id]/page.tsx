'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getCategory, type Category } from '@/lib/supabase/categories';
import { deleteCategoryAction } from '@/app/actions/crud';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { Skeleton } from '@/components/common/Skeleton';
import {
  RegistryDeleteDialog,
  RegistryDeleteDialogTriggerButton,
} from '@/components/common/delete-confirm-dialog';
import { isDeleteBlocked, type DeleteBlockingInfo } from '@/lib/delete/delete-fk-blocking';
import { ArrowLeftIcon, PencilIcon, Trash2Icon } from 'lucide-react';

export default function CategoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteBlocking, setDeleteBlocking] = useState<DeleteBlockingInfo | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { data, error: fetchError } = await getCategory(id);
        if (fetchError) {
          setError(fetchError.message);
        } else if (!data) {
          setError('Category not found.');
        } else {
          setCategory(data);
        }
      } catch (err: any) {
        setError(err.message ?? 'Failed to load category');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteBlocking(null);
    try {
      const result = await deleteCategoryAction(id);
      if (isDeleteBlocked(result)) {
        setDeleteBlocking(result.blocking);
      } else if ('error' in result && result.error) {
        setError(result.error);
      } else {
        router.push('/dashboard/categories');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete category');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <Skeleton className="h-5 w-36" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <Link href="/dashboard/categories" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="mr-2 h-4 w-4" />
          Back to Categories
        </Link>
        <ErrorAlert message={error} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link href="/dashboard/categories" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="mr-2 h-4 w-4" />
        Back to Categories
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>{category?.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-muted-foreground">ID</span>
            <span className="font-mono text-xs">{category?.id}</span>
            <span className="text-muted-foreground">Created At</span>
            <span>{category?.created_at ? new Date(category.created_at).toLocaleString() : '—'}</span>
            <span className="text-muted-foreground">Updated At</span>
            <span>{category?.updated_at ? new Date(category.updated_at).toLocaleString() : '—'}</span>
          </div>
          <div className="flex gap-3 pt-4">
            <Link href={`/dashboard/categories/${id}/edit`}>
              <Button variant="outline">
                <PencilIcon className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </Link>
            <RegistryDeleteDialogTriggerButton onClick={() => { setDeleteBlocking(null); setDialogOpen(true); }}>
              <Trash2Icon className="mr-2 h-4 w-4" />
              Delete
            </RegistryDeleteDialogTriggerButton>
          </div>
        </CardContent>
      </Card>

      {/* Delete dialog */}
      <RegistryDeleteDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setDeleteBlocking(null);
        }}
        title="Delete Category"
        description="Permanently remove this category. This action cannot be undone."
        detail={category?.name}
        blocking={deleteBlocking}
        onConfirm={handleDelete}
        confirming={deleting}
      />
    </div>
  );
}
