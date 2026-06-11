'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/enterprise/page-header';
import { GlassPanel } from '@/components/enterprise/glass-panel';
import { StatusBadge } from '@/components/enterprise/status-badge';
import { Settings, Shield, Bell, Database, Loader2Icon, CheckCircle2, DatabaseZap } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { getRoleEnumValues } from '@/lib/supabase/users';
import { seedDemoDataAction } from '@/app/actions/seed';
import { repairDatabaseSchemaAction, getSchemaRepairSqlAction } from '@/app/actions/schema-repair';
import {
  repairAuditLogTriggerAction,
  getAuditLogTriggerFixSqlAction,
  verifyAuditLogTriggerAction,
} from '@/app/actions/audit-trigger-repair';
import { Skeleton } from '@/components/common/Skeleton';
import { cn } from '@/lib/utils';
import { ErrorAlert } from '@/components/common/ErrorAlert';

export default function SettingsPage() {
  const { user, profile, loading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<'general' | 'security'>('general');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);

  const [companyName, setCompanyName] = useState('Acme Corp');
  const [adminEmail, setAdminEmail] = useState('admin@acme.com');
  const [retentionPeriod, setRetentionPeriod] = useState('365');
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<string | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [repairing, setRepairing] = useState(false);
  const [repairResult, setRepairResult] = useState<string | null>(null);
  const [repairError, setRepairError] = useState<string | null>(null);
  const [auditFixing, setAuditFixing] = useState(false);
  const [auditFixResult, setAuditFixResult] = useState<string | null>(null);
  const [auditFixError, setAuditFixError] = useState<string | null>(null);
  const [auditVerifyStatus, setAuditVerifyStatus] = useState<string | null>(null);

  useEffect(() => {
    async function loadRoles() {
      try {
        const vals = await getRoleEnumValues();
        setRoles(vals);
      } catch (e) {
        console.error(e);
      }
    }
    loadRoles();
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
    }, 800);
  };

  const handleRepairSchema = async () => {
    setRepairing(true);
    setRepairError(null);
    setRepairResult(null);
    const result = await repairDatabaseSchemaAction();
    if (result.error) setRepairError(result.error);
    else setRepairResult(result.message ?? 'Schema repaired.');
    setRepairing(false);
  };

  const handleCopyRepairSql = async () => {
    const { sql } = await getSchemaRepairSqlAction();
    await navigator.clipboard.writeText(sql);
    setRepairResult('SQL copied. Paste into Supabase → SQL Editor → Run.');
  };

  const handleFixAuditTrigger = async () => {
    setAuditFixing(true);
    setAuditFixError(null);
    setAuditFixResult(null);
    const result = await repairAuditLogTriggerAction();
    if (result.error) setAuditFixError(result.error);
    else setAuditFixResult(result.message ?? 'Audit trigger repaired.');
    setAuditFixing(false);
    const verify = await verifyAuditLogTriggerAction();
    setAuditVerifyStatus(verify.ok ? 'Verified: inventory insert succeeds.' : `Still failing: ${verify.error}`);
  };

  const handleCopyAuditFixSql = async () => {
    const { sql } = await getAuditLogTriggerFixSqlAction();
    await navigator.clipboard.writeText(sql);
    setAuditFixResult('Audit trigger SQL copied. Paste into Supabase → SQL Editor → Run.');
  };

  const handleVerifyAuditTrigger = async () => {
    setAuditVerifyStatus('Checking…');
    const verify = await verifyAuditLogTriggerAction();
    setAuditVerifyStatus(
      verify.ok
        ? 'OK — write_audit_log() uses old_data/new_data.'
        : verify.staleTrigger
          ? 'FAIL — live function still references audit_logs.details. Run Fix Audit Log Trigger.'
          : `FAIL — ${verify.error}`
    );
  };

  const handleSeed = async () => {
    setSeeding(true);
    setSeedError(null);
    setSeedResult(null);
    const result = await seedDemoDataAction();
    if (result.error) setSeedError(result.error);
    else setSeedResult(result.summary ?? 'Demo data seeded successfully.');
    setSeeding(false);
  };

  const navItems = [
    { id: 'general' as const, label: 'General', icon: Settings },
    { id: 'security' as const, label: 'Authentication', icon: Shield },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        badge="Configuration"
        title="System Settings"
        description="Configure global asset management preferences and authentication."
      />

      <div className="grid gap-6 md:grid-cols-4">
        <GlassPanel className="p-3 md:col-span-1">
          <nav className="space-y-1">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  activeTab === id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
            <button
              type="button"
              disabled
              className="flex w-full cursor-not-allowed items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-muted-foreground opacity-50"
            >
              <Bell className="h-4 w-4" /> Notifications
            </button>
            <button
              type="button"
              disabled
              className="flex w-full cursor-not-allowed items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-muted-foreground opacity-50"
            >
              <Database className="h-4 w-4" /> Data Management
            </button>
          </nav>
        </GlassPanel>

        <div className="md:col-span-3">
          {activeTab === 'general' ? (
            <GlassPanel className="p-6">
              <div className="mb-6 border-b border-glass-border pb-4">
                <h3 className="font-semibold">General System Configuration</h3>
                <p className="text-xs text-muted-foreground">
                  Customize organizational parameters and contact endpoints.
                </p>
              </div>
              <form onSubmit={handleSave} className="space-y-6">
                {success && (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    Settings successfully updated!
                  </div>
                )}

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Organization / Company Name</Label>
                    <Input
                      id="companyName"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="rounded-xl border-0 bg-muted/40"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adminEmail">System Admin Contact Email</Label>
                    <Input
                      id="adminEmail"
                      type="email"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className="rounded-xl border-0 bg-muted/40"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="retention">Audit Log Retention Period (Days)</Label>
                    <Input
                      id="retention"
                      type="number"
                      value={retentionPeriod}
                      onChange={(e) => setRetentionPeriod(e.target.value)}
                      className="rounded-xl border-0 bg-muted/40"
                    />
                  </div>
                </div>

                <div className="flex justify-end border-t border-glass-border pt-4">
                  <Button type="submit" disabled={loading} className="rounded-xl">
                    {loading ? 'Saving...' : 'Save Settings'}
                  </Button>
                </div>
              </form>

              <div className="mt-8 border-t border-glass-border pt-6">
                <div className="mb-4 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-rose-400" />
                  <h4 className="text-sm font-semibold">Audit Log Trigger (required for Inventory)</h4>
                </div>
                <p className="mb-4 text-xs text-muted-foreground">
                  If inserts fail with audit log errors (e.g.{' '}
                  <code className="text-rose-400">details does not exist</code> or{' '}
                  <code className="text-rose-400">record_id uuid but expression is text</code>), redeploy{' '}
                  <code className="text-primary">write_audit_log()</code> below. It writes{' '}
                  <code className="text-primary">old_data</code> / <code className="text-primary">new_data</code> and UUID{' '}
                  <code className="text-primary">record_id</code>.
                </p>
                {auditFixError && <div className="mb-3"><ErrorAlert message={auditFixError} /></div>}
                {auditFixResult && !auditFixError && (
                  <div className="mb-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400">
                    {auditFixResult}
                  </div>
                )}
                {auditVerifyStatus && (
                  <p className="mb-3 text-xs text-muted-foreground">{auditVerifyStatus}</p>
                )}
                <div className="mb-6 flex flex-wrap gap-2">
                  <Button type="button" variant="default" onClick={handleFixAuditTrigger} disabled={auditFixing} className="rounded-xl">
                    {auditFixing && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
                    Fix Audit Log Trigger
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCopyAuditFixSql} className="rounded-xl">
                    Copy Trigger SQL
                  </Button>
                  <Button type="button" variant="ghost" onClick={handleVerifyAuditTrigger} className="rounded-xl">
                    Verify
                  </Button>
                </div>
              </div>

              <div className="mt-8 border-t border-glass-border pt-6">
                <div className="mb-4 flex items-center gap-2">
                  <Database className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-semibold">Database Schema Repair</h4>
                </div>
                <p className="mb-4 text-xs text-muted-foreground">
                  Optional maintenance for missing tables/columns (assets, maintenance, allocations). Does not alter{' '}
                  <code className="text-primary">asset_requests</code> or <code className="text-primary">vendors</code>{' '}
                  shapes — application code is aligned to your live schema. Add{' '}
                  <code className="text-primary">SUPABASE_DB_PASSWORD</code> to .env.local for one-click repair, or copy the SQL into Supabase SQL Editor.
                </p>
                {repairError && <div className="mb-3"><ErrorAlert message={repairError} /></div>}
                {repairResult && !repairError && (
                  <div className="mb-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400">
                    {repairResult}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={handleRepairSchema} disabled={repairing} className="rounded-xl">
                    {repairing && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
                    Repair Schema
                  </Button>
                  <Button type="button" variant="ghost" onClick={handleCopyRepairSql} className="rounded-xl">
                    Copy Fix SQL
                  </Button>
                </div>
              </div>

              <div className="mt-8 border-t border-glass-border pt-6">
                <div className="mb-4 flex items-center gap-2">
                  <DatabaseZap className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-semibold">Demo Data</h4>
                </div>
                <p className="mb-4 text-xs text-muted-foreground">
                  Populate the database with 50 assets, 10 vendors, 10 categories, 20 requests, 15 maintenance records, and notifications. Requires schema + RLS policies applied first.
                </p>
                {seedError && <div className="mb-3"><ErrorAlert message={seedError} /></div>}
                {seedResult && (
                  <div className="mb-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400">
                    {seedResult}
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSeed}
                  disabled={seeding}
                  className="rounded-xl"
                >
                  {seeding && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
                  Seed Demo Data
                </Button>
              </div>
            </GlassPanel>
          ) : (
            <GlassPanel className="p-6">
              <div className="mb-6 border-b border-glass-border pb-4">
                <h3 className="font-semibold">Authentication Settings</h3>
                <p className="text-xs text-muted-foreground">
                  Monitor identity provider metadata and system access definitions.
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between rounded-xl border border-glass-border bg-muted/10 p-4">
                  <div className="space-y-0.5">
                    <span className="text-sm font-semibold">Supabase Authentication</span>
                    <p className="text-xs text-muted-foreground">Enterprise SSO and session management.</p>
                  </div>
                  {user ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                      Connected
                    </span>
                  ) : (
                    <StatusBadge status="Inactive" />
                  )}
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Session Metadata
                  </h4>
                  <div className="grid grid-cols-3 gap-y-3 gap-x-2 rounded-xl border border-glass-border bg-muted/10 p-4 text-sm">
                    <span className="text-muted-foreground">Current user</span>
                    <span className="col-span-2 font-medium">
                      {authLoading ? (
                        <Loader2Icon className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : profile ? (
                        `${profile.first_name} ${profile.last_name}`
                      ) : (
                        user?.email ?? '—'
                      )}
                    </span>

                    <span className="text-muted-foreground">Active Email</span>
                    <span className="col-span-2 font-mono text-xs">{user?.email ?? '—'}</span>

                    <span className="text-muted-foreground">Auth User ID</span>
                    <span className="col-span-2 select-all font-mono text-xs text-violet-400">
                      {user?.id ?? '—'}
                    </span>

                    <span className="text-muted-foreground">App Role</span>
                    <span className="col-span-2">
                      {profile?.role ? <StatusBadge status={profile.role} /> : '—'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Role Management
                  </h4>
                  <p className="mb-2 text-xs text-muted-foreground">
                    Available roles: Admin, Manager, Employee
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {roles.length > 0 ? (
                      roles.map((r) => <StatusBadge key={r} status={r} />)
                    ) : (
                      <Skeleton className="h-6 w-32 rounded-full" />
                    )}
                  </div>
                </div>
              </div>
            </GlassPanel>
          )}
        </div>
      </div>
    </div>
  );
}
