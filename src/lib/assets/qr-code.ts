/** Enterprise asset QR — scan-to-open verification URLs. */

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

export function resolveSerialNumber(asset: Pick<AssetQrFields, 'asset_tag' | 'serial_number'>): string {
  const serial = asset.serial_number?.trim();
  return serial || asset.asset_tag;
}

export function getAppBaseUrl(): string | undefined {
  if (process.env.NEXT_PUBLIC_APP_URL?.trim()) {
    return process.env.NEXT_PUBLIC_APP_URL.trim();
  }
  if (process.env.VERCEL_URL?.trim()) {
    return `https://${process.env.VERCEL_URL.trim()}`;
  }
  if (process.env.NEXT_PUBLIC_SITE_URL?.trim()) {
    return process.env.NEXT_PUBLIC_SITE_URL.trim();
  }
  return undefined;
}

export function getCompanyName(): string {
  return process.env.NEXT_PUBLIC_COMPANY_NAME?.trim() || 'ROR Technologies';
}

function normalizeOrigin(baseUrl?: string | null): string {
  if (baseUrl?.trim()) return baseUrl.replace(/\/$/, '');
  const fromEnv = getAppBaseUrl();
  if (fromEnv && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(fromEnv)) {
    return fromEnv.replace(/\/$/, '');
  }
  return 'https://your-vercel-domain.vercel.app';
}

function isLocalUrl(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(url);
}

/** Public verification deep link encoded in every asset QR code. */
export function buildAssetVerificationUrl(assetTag: string, baseUrl?: string | null): string {
  const origin = normalizeOrigin(baseUrl);
  return `${origin}/verify/${encodeURIComponent(assetTag)}`;
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
  if (trimmed) {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      if (isLocalUrl(trimmed)) return buildAssetVerificationUrl(asset.asset_tag, baseUrl);
      return trimmed;
    }
    const legacy = parseLegacyAssetQrPayload(trimmed);
    if (legacy?.url) return legacy.url;
    if (legacy?.tag) {
      return buildAssetVerificationUrl(legacy.tag, baseUrl);
    }
  }
  return buildAssetVerificationUrl(asset.asset_tag, baseUrl);
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
