import type { ReactNode } from 'react';
import {
  BadgeCheck,
  Building2,
  Calendar,
  Hash,
  Package,
  Shield,
  Tag,
  User,
  Wrench,
} from 'lucide-react';
import { StatusBadge } from '@/components/enterprise/status-badge';
import type { AssetVerificationProfile } from '@/lib/assets/asset-verification';
import { getCompanyName } from '@/lib/assets/qr-code';
import { cn } from '@/lib/utils';

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function VerificationField({
  icon: Icon,
  label,
  value,
  mono,
  highlight,
}: {
  icon: typeof Package;
  label: string;
  value: ReactNode;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10">
        <Icon className="h-4 w-4 text-violet-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
        <div
          className={cn(
            'mt-1 text-sm font-medium text-white',
            mono && 'font-mono text-[13px]',
            highlight && 'text-violet-200'
          )}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

export function AssetVerificationProfileView({
  profile,
}: {
  profile: AssetVerificationProfile;
}) {
  const companyName = getCompanyName();
  const warrantyExpired =
    profile.warranty_expiry && new Date(profile.warranty_expiry) < new Date();

  return (
    <div className="mx-auto w-full max-w-lg">
      <header className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-600/30 to-indigo-600/20 shadow-lg shadow-violet-500/20">
          <Building2 className="h-7 w-7 text-violet-300" />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-violet-400">
          {companyName}
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
          Asset Verification
        </h1>
      </header>

      <div className="mb-5 flex justify-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 shadow-[0_0_24px_rgba(16,185,129,0.15)]">
          <BadgeCheck className="h-5 w-5 text-emerald-400" />
          <span className="text-sm font-semibold text-emerald-300">Asset Verified</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-violet-500/20 bg-[#0c0c12]/90 shadow-2xl shadow-violet-950/40 backdrop-blur-xl">
        <div className="border-b border-white/[0.06] bg-gradient-to-r from-violet-600/15 via-transparent to-indigo-600/10 px-5 py-5 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Asset Name
          </p>
          <h2 className="mt-1 text-lg font-semibold leading-snug text-white sm:text-xl">
            {profile.name}
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={profile.status} />
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-zinc-400">
              {profile.allocation_status}
            </span>
          </div>
        </div>

        <div className="space-y-3 p-4 sm:p-5">
          <VerificationField icon={Hash} label="Asset Tag" value={profile.asset_tag} mono highlight />
          <VerificationField icon={Package} label="Serial Number" value={profile.serial_number} mono />
          <VerificationField
            icon={Tag}
            label="Category"
            value={profile.category ?? 'Uncategorized'}
          />
          <VerificationField icon={Shield} label="Status" value={<StatusBadge status={profile.status} />} />
          <VerificationField
            icon={User}
            label="Allocation Status"
            value={profile.allocation_status}
          />
          <VerificationField
            icon={User}
            label="Assigned Employee"
            value={profile.assigned_employee ?? 'Not assigned'}
          />
          <VerificationField
            icon={Building2}
            label="Department"
            value={profile.department ?? '—'}
          />
          <VerificationField
            icon={Calendar}
            label="Purchase Date"
            value={formatDate(profile.purchase_date)}
          />
          <VerificationField
            icon={Wrench}
            label="Warranty Information"
            value={
              <span className={warrantyExpired ? 'text-amber-300' : 'text-emerald-300'}>
                {profile.warranty_label}
              </span>
            }
          />
          <VerificationField
            icon={Calendar}
            label="Last Updated"
            value={formatDate(profile.updated_at)}
          />
        </div>
      </div>

      <p className="mt-6 text-center text-xs leading-relaxed text-zinc-600">
        Official asset record verified by {companyName}. For internal changes, sign in to the
        asset management portal.
      </p>
    </div>
  );
}

export function AssetNotFoundView({ assetTag }: { assetTag: string }) {
  const companyName = getCompanyName();

  return (
    <div className="mx-auto w-full max-w-lg text-center">
      <header className="mb-8">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-700/50 bg-zinc-900/80">
          <Building2 className="h-7 w-7 text-zinc-500" />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-500">
          {companyName}
        </p>
      </header>

      <div className="rounded-3xl border border-rose-500/20 bg-[#0c0c12]/90 px-6 py-10 shadow-2xl backdrop-blur-xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/10">
          <Package className="h-8 w-8 text-rose-400" />
        </div>
        <h1 className="text-2xl font-semibold text-white">Asset Not Found</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          No registered asset matches tag{' '}
          <span className="font-mono text-zinc-300">{assetTag}</span>. The QR code may be
          outdated, misprinted, or the asset may have been retired from the registry.
        </p>
      </div>

      <p className="mt-6 text-xs text-zinc-600">
        Contact your IT or asset management team if you believe this is an error.
      </p>
    </div>
  );
}
