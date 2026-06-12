/** Enterprise asset QR — scan-to-open verification URLs. */

import { getAppUrl, getConfiguredAppOrigin, isLocalOrigin } from '@/lib/auth/site-url';

export type AssetQrFields = {
  id: string;
  name: string;
  asset_tag: string;
  serial_number?: string | null;
};

export type AssetQrDisplayMeta = {
  name: string;
  tag: string;
  serial: string;
  verificationUrl: string;
};

/** @deprecated Legacy JSON payload — only used when migrating stored qr_payload values. */
export type AssetQrPayload = {
  id: string;
  name: string;
  tag: string;
  serial: string;
  url?: string;
};

const PLACEHOLDER_HOST_RE = /your-vercel-domain|example\.com|placeholder/i;

export function resolveSerialNumber(asset: Pick<AssetQrFields, 'asset_tag' | 'serial_number'>): string {
  const serial = asset.serial_number?.trim();
  return serial || asset.asset_tag;
}

/** Canonical production origin for QR links (server + client build-time env). */
export function getAppBaseUrl(): string | undefined {
  return getConfiguredAppOrigin();
}

export function getCompanyName(): string {
  return process.env.NEXT_PUBLIC_COMPANY_NAME?.trim() || 'ROR Technologies';
}

function isPlaceholderHost(hostname: string): boolean {
  return PLACEHOLDER_HOST_RE.test(hostname);
}

function isPlaceholderUrl(url: string): boolean {
  try {
    return isPlaceholderHost(new URL(url).hostname);
  } catch {
    return true;
  }
}

function normalizeOrigin(baseUrl?: string | null): string {
  if (baseUrl?.trim()) {
    const normalized = baseUrl.trim().replace(/\/$/, '');
    if (!isLocalOrigin(normalized) && !isPlaceholderUrl(normalized)) {
      return normalized;
    }
  }

  const resolved = getAppUrl();
  if (!isPlaceholderUrl(resolved)) {
    return resolved;
  }

  return getAppUrl();
}

/** True when a stored qr_payload URL must not be encoded (stale / placeholder / wrong host). */
export function shouldRebuildStoredQrUrl(storedUrl: string, baseUrl?: string | null): boolean {
  const trimmed = storedUrl.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return false;
  }
  if (isLocalOrigin(trimmed) || isPlaceholderUrl(trimmed)) {
    return true;
  }

  const canonical = normalizeOrigin(baseUrl);
  if (isLocalOrigin(canonical)) {
    return false;
  }

  try {
    const storedOrigin = new URL(trimmed).origin;
    const canonicalOrigin = new URL(canonical).origin;
    return storedOrigin !== canonicalOrigin;
  } catch {
    return true;
  }
}

/** Public verification deep link encoded in every asset QR code. */
export function buildAssetVerificationUrl(assetTag: string, baseUrl?: string | null): string {
  const origin = normalizeOrigin(baseUrl);
  const qrUrl = `${origin}/verify/${encodeURIComponent(assetTag)}`;

  if (process.env.NODE_ENV === 'development') {
    console.log('[QR GENERATED URL]', {
      qrUrl,
      assetTag,
      origin,
      env: {
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? null,
        NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? null,
        VERCEL_URL: process.env.VERCEL_URL ?? null,
      },
    });
  }

  return qrUrl;
}

/** Stored qr_payload value — always a plain verification URL. */
export function serializeAssetQrContent(verificationUrl: string): string {
  return verificationUrl.trim();
}

export function buildAssetQrDisplayMeta(
  asset: AssetQrFields,
  baseUrl?: string | null
): AssetQrDisplayMeta {
  const serial = resolveSerialNumber(asset);
  return {
    name: asset.name,
    tag: asset.asset_tag,
    serial,
    verificationUrl: buildAssetVerificationUrl(asset.asset_tag, baseUrl),
  };
}

/** Resolve QR image content from stored payload or asset fields (supports legacy JSON). */
export function resolveAssetQrContent(
  asset: AssetQrFields,
  storedPayload?: string | null,
  baseUrl?: string | null
): string {
  const trimmed = storedPayload?.trim();
  let qrUrl: string;
  let source: 'stored' | 'rebuilt-local' | 'rebuilt-stale' | 'rebuilt-legacy' | 'generated' = 'generated';

  if (trimmed) {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      if (isLocalOrigin(trimmed)) {
        qrUrl = buildAssetVerificationUrl(asset.asset_tag, baseUrl);
        source = 'rebuilt-local';
      } else if (shouldRebuildStoredQrUrl(trimmed, baseUrl)) {
        qrUrl = buildAssetVerificationUrl(asset.asset_tag, baseUrl);
        source = 'rebuilt-stale';
      } else {
        qrUrl = trimmed;
        source = 'stored';
      }
    } else {
      const legacy = parseLegacyAssetQrPayload(trimmed);
      if (legacy?.url && !shouldRebuildStoredQrUrl(legacy.url, baseUrl)) {
        qrUrl = legacy.url;
        source = 'stored';
      } else if (legacy?.tag) {
        qrUrl = buildAssetVerificationUrl(legacy.tag, baseUrl);
        source = 'rebuilt-legacy';
      } else {
        qrUrl = buildAssetVerificationUrl(asset.asset_tag, baseUrl);
        source = 'generated';
      }
    }
  } else {
    qrUrl = buildAssetVerificationUrl(asset.asset_tag, baseUrl);
    source = 'generated';
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[QR RESOLVED URL]', {
      qrUrl,
      assetTag: asset.asset_tag,
      source,
      storedPayload: trimmed ?? null,
      env: {
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? null,
        NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? null,
        VERCEL_URL: process.env.VERCEL_URL ?? null,
      },
    });
  }

  return qrUrl;
}

export function parseLegacyAssetQrPayload(raw: string | null | undefined): AssetQrPayload | null {
  if (!raw?.trim()) return null;
  try {
    const data = JSON.parse(raw) as Partial<AssetQrPayload>;
    if (!data.tag && !data.id) return null;
    return {
      id: String(data.id ?? ''),
      name: String(data.name ?? data.tag ?? ''),
      tag: String(data.tag ?? ''),
      serial: String(data.serial ?? data.tag ?? ''),
      url: data.url ? String(data.url) : undefined,
    };
  } catch {
    return null;
  }
}

/** @deprecated Use resolveAssetQrContent — kept for any remaining imports. */
export function buildAssetQrPayload(asset: AssetQrFields, baseUrl?: string | null): AssetQrPayload {
  const serial = resolveSerialNumber(asset);
  const verificationUrl = buildAssetVerificationUrl(asset.asset_tag, baseUrl);
  return {
    id: asset.id,
    name: asset.name,
    tag: asset.asset_tag,
    serial,
    url: verificationUrl,
  };
}

/** @deprecated Use serializeAssetQrContent with a verification URL. */
export function serializeAssetQrPayload(payload: AssetQrPayload): string {
  if (payload.url) return payload.url;
  return JSON.stringify(payload);
}

/** @deprecated Use parseLegacyAssetQrPayload. */
export function parseAssetQrPayload(raw: string | null | undefined): AssetQrPayload | null {
  if (!raw?.trim()) return null;
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    const tagMatch = raw.match(/\/(?:asset-lookup|verify)\/([^/?#]+)/);
    const tag = tagMatch ? decodeURIComponent(tagMatch[1]) : '';
    return {
      id: '',
      name: tag,
      tag,
      serial: tag,
      url: raw,
    };
  }
  return parseLegacyAssetQrPayload(raw);
}
