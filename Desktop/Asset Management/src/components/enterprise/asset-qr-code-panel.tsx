'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, ExternalLink, Loader2, Printer, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/enterprise/glass-panel';
import {
  buildAssetQrDisplayMeta,
  getCompanyName,
  resolveAssetQrContent,
  type AssetQrDisplayMeta,
} from '@/lib/assets/qr-code';
import {
  downloadQrPng,
  generateAssetQrDataUrl,
  printAssetQrLabel,
} from '@/lib/assets/qr-code-image';
import { cn } from '@/lib/utils';

export type AssetQrSource = {
  id: string;
  name: string;
  asset_tag: string;
  serial_number?: string | null;
  qr_payload?: string | null;
  qr_generated_at?: string | null;
};

type AssetQrCodePanelProps = {
  asset: AssetQrSource;
  variant?: 'card' | 'embedded';
  className?: string;
};

export function AssetQrCodePanel({
  asset,
  variant = 'card',
  className,
}: AssetQrCodePanelProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : undefined;

  const meta = useMemo((): AssetQrDisplayMeta => {
    return buildAssetQrDisplayMeta(asset, origin);
  }, [asset, origin]);

  const qrContent = useMemo(() => {
    return resolveAssetQrContent(asset, asset.qr_payload, origin);
  }, [asset, origin]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    generateAssetQrDataUrl(qrContent)
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to generate QR code');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [qrContent]);

  const handleDownload = useCallback(() => {
    if (!dataUrl) return;
    downloadQrPng(dataUrl, `asset-qr-${asset.asset_tag}.png`);
  }, [dataUrl, asset.asset_tag]);

  const handlePrint = useCallback(() => {
    if (!dataUrl) return;
    printAssetQrLabel({ dataUrl, meta, companyName: getCompanyName() });
  }, [dataUrl, meta]);

  const content = (
    <div className={cn('flex flex-col', variant === 'embedded' ? 'gap-4' : 'gap-5')}>
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10">
          <QrCode className="h-4 w-4 text-violet-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Asset QR Tag</h3>
          <p className="text-xs text-muted-foreground">
            Scan-to-verify URL — opens on any phone camera
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative shrink-0 rounded-2xl border border-violet-500/20 bg-white p-3 shadow-lg shadow-violet-500/10"
        >
          {loading && (
            <div className="flex h-[200px] w-[200px] items-center justify-center sm:h-[220px] sm:w-[220px]">
              <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
            </div>
          )}
          {!loading && dataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dataUrl}
              alt={`QR code for ${asset.asset_tag}`}
              width={220}
              height={220}
              className="h-[200px] w-[200px] sm:h-[220px] sm:w-[220px]"
            />
          )}
          {!loading && error && (
            <div className="flex h-[200px] w-[200px] items-center justify-center px-4 text-center text-xs text-rose-400">
              {error}
            </div>
          )}
        </motion.div>

        <div className="w-full min-w-0 flex-1 space-y-3">
          <div className="grid gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs sm:grid-cols-2">
            <MetaRow label="Asset Tag" value={meta.tag} mono />
            <MetaRow label="Serial" value={meta.serial} mono />
            <MetaRow label="Name" value={meta.name} className="sm:col-span-2" />
            <MetaRow
              label="Verification URL"
              value={qrContent.replace(/^https?:\/\//, '')}
              mono
              className="sm:col-span-2"
            />
            {asset.qr_generated_at && (
              <MetaRow
                label="Generated"
                value={new Date(asset.qr_generated_at).toLocaleString()}
                className="sm:col-span-2"
              />
            )}
          </div>

          <a
            href={qrContent}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl border border-violet-500/20 bg-violet-500/5 px-3 py-2 text-xs text-violet-300 transition hover:bg-violet-500/10"
          >
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Preview verification page</span>
          </a>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-xl border-violet-500/25 bg-violet-500/5 hover:bg-violet-500/10"
              onClick={handlePrint}
              disabled={!dataUrl || loading}
            >
              <Printer className="mr-2 h-4 w-4" />
              Print QR Label
            </Button>
            <Button
              type="button"
              className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500"
              onClick={handleDownload}
              disabled={!dataUrl || loading}
            >
              <Download className="mr-2 h-4 w-4" />
              Download QR
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  if (variant === 'embedded') {
    return <div className={className}>{content}</div>;
  }

  return (
    <GlassPanel className={cn('p-5 sm:p-6', className)} hover>
      {content}
    </GlassPanel>
  );
}

function MetaRow({
  label,
  value,
  mono,
  truncate,
  className,
}: {
  label: string;
  value: string;
  mono?: boolean;
  truncate?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          'mt-0.5 font-medium text-foreground/90',
          mono && 'font-mono text-[11px]',
          truncate && 'truncate'
        )}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}
