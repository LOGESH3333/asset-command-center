'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getMaintenanceRecord, type MaintenanceRecord } from '@/lib/supabase/maintenance';
import { deleteMaintenanceAction } from '@/app/actions/crud';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import {
  RegistryDeleteDialog,
  RegistryDeleteDialogTriggerButton,
} from '@/components/common/delete-confirm-dialog';
import { isDeleteBlocked, type DeleteBlockingInfo } from '@/lib/delete/delete-fk-blocking';
import { ArrowLeftIcon, Loader2Icon, TrashIcon, PencilIcon } from 'lucide-react';

export default function MaintenanceDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [record, setRecord] = useState<MaintenanceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteBlocking, setDeleteBlocking] = useState<DeleteBlockingInfo | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    async function loadRecord() {
      try {
        const { data, error: loadError } = await getMaintenanceRecord(id);
        if (loadError) {
          setError(loadError.message);
        } else if (data) {
          setRecord(data);
        } else {
          setError('Maintenance record not found');
        }
      } catch (err: any) {
        setError(err.message ?? 'Failed to load maintenance record');
      } finally {
        setLoading(false);
      }
    }
    loadRecord();
  }, [id]);

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteBlocking(null);
    try {
      const result = await deleteMaintenanceAction(id);
      if (isDeleteBlocked(result)) {
        setDeleteBlocking(result.blocking);
      } else if ('error' in result && result.error) {
        setError(result.error);
        setDialogOpen(false);
      } else {
        router.push('/dashboard/maintenance');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete maintenance record');
      setDialogOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2Icon className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <ErrorAlert message={error || 'Record not found'} />
        <Link href="/dashboard/maintenance">
          <Button variant="outline">Back to Maintenance</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/dashboard/maintenance" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="mr-2 h-4 w-4" />
          Back to Maintenance
        </Link>
        <div className="flex gap-2">
          <Link href={`/dashboard/maintenance/${record.id}/edit`}>
            <Button variant="outline" size="sm">
              <PencilIcon className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </Link>
          <RegistryDeleteDialogTriggerButton className="h-8 px-3 text-sm" onClick={() => { setDeleteBlocking(null); setDialogOpen(true); }}>
            <TrashIcon className="mr-2 h-4 w-4" />
            Delete
          </RegistryDeleteDialogTriggerButton>
        </div>
      </div>

      <Card className="bg-gradient-to-br from-card to-card/50 shadow-sm border-border/50">
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-2xl">Maintenance Details</CardTitle>
            <CardDescription className="mt-1">
              Logged on {new Date(record.created_at).toLocaleString()}
            </CardDescription>
          </div>
          <div>
            <Badge variant={record.type === 'Preventive' ? 'outline' : 'secondary'}>
              {record.type}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && <ErrorAlert message={error} />}

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground">Asset</h3>
              <p className="text-base font-medium mt-1">
                {record.assets ? `${record.assets.name} (${record.assets.asset_tag})` : '—'}
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-muted-foreground">Vendor</h3>
              <p className="text-base font-medium mt-1">
                {record.vendors?.name || '—'}
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-muted-foreground">Scheduled Date</h3>
              <p className="text-base font-medium mt-1">
                {record.scheduled_date ? new Date(record.scheduled_date).toLocaleDateString() : '—'}
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-muted-foreground">Completed Date</h3>
              <p className="text-base font-medium mt-1">
                {record.completed_date ? new Date(record.completed_date).toLocaleDateString() : '—'}
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-muted-foreground">Cost</h3>
              <p className="text-base font-medium mt-1">
                {record.cost !== null ? `$${Number(record.cost).toFixed(2)}` : '—'}
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-muted-foreground">Performed By</h3>
              <p className="text-base font-medium mt-1">
                {record.performed_by || '—'}
              </p>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Description</h3>
            <p className="text-base mt-1 whitespace-pre-line">{record.description}</p>
          </div>

          {record.notes && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-muted-foreground">Notes</h3>
              <p className="text-base mt-1 whitespace-pre-line">{record.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <RegistryDeleteDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setDeleteBlocking(null);
        }}
        title="Delete Maintenance Record"
        description="Permanently remove this maintenance record. This action cannot be undone."
        blocking={deleteBlocking}
        onConfirm={handleDelete}
        confirming={deleting}
      />
    </div>
  );
}
