'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { GlassPanel } from '@/components/enterprise/glass-panel';
import { StatusBadge } from '@/components/enterprise/status-badge';
import { PageHeader } from '@/components/enterprise/page-header';
import {
  ChevronLeftIcon,
  PencilIcon,
  CalendarIcon,
  DollarSignIcon,
  ShieldAlertIcon,
  Building2,
  UserIcon,
  History,
  Wrench,
  Package,
} from 'lucide-react';
import { AssetQrCodePanel } from '@/components/enterprise/asset-qr-code-panel';

export default function AssetDetailsPage() {
  const params = useParams();
  const id = params.id as string;

  const [asset, setAsset] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [maintenanceHistory, setMaintenanceHistory] = useState<any[]>([]);

  useEffect(() => {
    async function fetchAssetDetails() {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('assets')
          .select(`
            *,
            category:asset_categories(name),
            vendor:vendors(name, contact_person, email, phone),
            user:users!assigned_employee_id(first_name, last_name, department, email)
          `)
          .eq('asset_tag', id)
          .single();

        if (fetchError) {
          setError(fetchError.message);
        } else {
          setAsset(data);
          if (data?.id) {
            const { data: maintData } = await supabase
              .from('maintenance_records')
              .select('id, type, description, scheduled_date, completed_date, cost')
              .eq('asset_id', data.id)
              .order('scheduled_date', { ascending: false })
              .limit(5);
            setMaintenanceHistory(maintData || []);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load asset details');
      } finally {
        setLoading(false);
      }
    }

    if (id) fetchAssetDetails();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="mt-4 text-sm text-muted-foreground">Loading asset intelligence...</p>
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/assets">
          <Button variant="ghost" size="sm" className="rounded-xl">
            <ChevronLeftIcon className="mr-2 h-4 w-4" />
            Back to Assets
          </Button>
        </Link>
        <ErrorAlert message={error ?? 'Asset not found.'} />
      </div>
    );
  }

  const timeline = [
    {
      label: 'Registered',
      date: asset.created_at,
      icon: Package,
      color: 'text-blue-500 bg-blue-500/10',
    },
    ...(asset.purchase_date
      ? [{ label: 'Purchased', date: asset.purchase_date, icon: CalendarIcon, color: 'text-emerald-500 bg-emerald-500/10' }]
      : []),
    ...(asset.warranty_expiry
      ? [{ label: 'Warranty Expires', date: asset.warranty_expiry, icon: ShieldAlertIcon, color: 'text-amber-500 bg-amber-500/10' }]
      : []),
    ...maintenanceHistory.map((m) => ({
      label: m.type ?? 'Maintenance',
      date: m.scheduled_date,
      icon: Wrench,
      color: 'text-violet-500 bg-violet-500/10',
      detail: m.description,
    })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/dashboard/assets">
          <Button variant="ghost" size="sm" className="rounded-xl">
            <ChevronLeftIcon className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <Link href={`/dashboard/assets/${asset.asset_tag}/edit`}>
          <Button className="rounded-xl bg-gradient-to-r from-primary to-indigo-600">
            <PencilIcon className="mr-2 h-4 w-4" />
            Edit Asset
          </Button>
        </Link>
      </div>

      <PageHeader
        badge={asset.asset_tag}
        title={asset.name}
        description={`${asset.category?.name ?? 'Uncategorized'} · ${asset.vendor?.name ?? 'No vendor'}`}
        actions={<StatusBadge status={asset.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Overview */}
        <GlassPanel className="lg:col-span-2 p-6" hover>
          <h3 className="mb-6 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Asset Overview
          </h3>
          <div className="grid gap-6 sm:grid-cols-2">
            {[
              { icon: DollarSignIcon, label: 'Valuation', value: asset.cost != null ? `$${Number(asset.cost).toLocaleString()}` : '—', color: 'text-emerald-500 bg-emerald-500/10' },
              { icon: Package, label: 'Serial Number', value: asset.serial_number ?? asset.asset_tag, color: 'text-violet-500 bg-violet-500/10' },
              { icon: CalendarIcon, label: 'Purchase Date', value: asset.purchase_date ? new Date(asset.purchase_date).toLocaleDateString() : '—', color: 'text-blue-500 bg-blue-500/10' },
              { icon: ShieldAlertIcon, label: 'Warranty Expiry', value: asset.warranty_expiry ? new Date(asset.warranty_expiry).toLocaleDateString() : '—', color: 'text-amber-500 bg-amber-500/10' },
              { icon: Building2, label: 'Vendor', value: asset.vendor?.name ?? '—', color: 'text-cyan-500 bg-cyan-500/10' },
            ].map((item, idx) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="erp-dark-glass flex items-center gap-4 rounded-xl p-4"
              >
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${item.color}`}>
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                  <p className="text-sm font-semibold">{item.value}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {asset.notes && (
            <div className="mt-6 border-t border-glass-border pt-6">
              <h4 className="mb-2 text-sm font-semibold">Notes</h4>
              <p className="erp-dark-glass rounded-xl p-4 text-sm leading-relaxed text-zinc-400">
                {asset.notes}
              </p>
            </div>
          )}
        </GlassPanel>

        {/* Assignment */}
        <div className="space-y-4">
          <GlassPanel className="p-5" hover>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Current Assignment
            </h3>
            {asset.user ? (
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UserIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">{asset.user.first_name} {asset.user.last_name}</p>
                  <p className="text-xs text-muted-foreground">{asset.user.department} · {asset.user.email}</p>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center text-sm text-muted-foreground">
                <UserIcon className="mx-auto mb-2 h-8 w-8 opacity-40" />
                Available for allocation
              </div>
            )}
          </GlassPanel>
        </div>
      </div>

      {/* Enterprise QR tagging */}
      <AssetQrCodePanel
        asset={{
          id: asset.id,
          name: asset.name,
          asset_tag: asset.asset_tag,
          serial_number: asset.serial_number,
          qr_payload: asset.qr_payload,
          qr_generated_at: asset.qr_generated_at,
        }}
      />

      {/* Timeline + Maintenance */}
      <div className="grid gap-6 lg:grid-cols-2">
        <GlassPanel className="p-5" hover>
          <div className="mb-4 flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Activity Timeline</h3>
          </div>
          <div className="relative space-y-1 pl-2">
            <div className="absolute left-[19px] top-2 bottom-2 w-px bg-border/60" />
            {timeline.map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="relative flex gap-3 rounded-xl p-3"
              >
                <div className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.color}`}>
                  <item.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.date).toLocaleDateString()}
                  </p>
                  {'detail' in item && item.detail && (
                    <p className="mt-0.5 text-xs text-muted-foreground/70">{item.detail}</p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel className="p-5" hover>
          <div className="mb-4 flex items-center gap-2">
            <Wrench className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Maintenance History</h3>
          </div>
          {maintenanceHistory.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No maintenance records</p>
          ) : (
            <div className="space-y-2">
              {maintenanceHistory.map((m) => (
                <div key={m.id} className="erp-dark-glass erp-dark-glass-interactive rounded-xl p-4 transition-colors">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{m.type}</p>
                    {m.cost != null && (
                      <span className="text-xs font-semibold text-emerald-500">${m.cost}</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{m.description}</p>
                  <p className="mt-2 text-[10px] text-muted-foreground/70">
                    {m.scheduled_date ? new Date(m.scheduled_date).toLocaleDateString() : '—'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}
