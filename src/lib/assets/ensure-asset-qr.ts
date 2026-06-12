import {
  buildAssetVerificationUrl,
  getAppBaseUrl,
  resolveSerialNumber,
  serializeAssetQrContent,
  shouldRebuildStoredQrUrl,
  type AssetQrFields,
} from './qr-code';
import { updateAssetRow } from '@/lib/supabase/assets-schema';

export type AssetQrMetadata = {
  serial_number: string;
  qr_payload: string;
  qr_generated_at: string;
};

/** Persist serial + verification URL for an asset row (create / update). */
export async function ensureAssetQrMetadata(
  asset: AssetQrFields & { qr_payload?: string | null }
): Promise<AssetQrMetadata> {
  const serial_number = resolveSerialNumber(asset);
  const stored = asset.qr_payload?.trim();
  const verificationUrl = buildAssetVerificationUrl(asset.asset_tag);
  const qr_payload = serializeAssetQrContent(verificationUrl);

  if (stored && shouldRebuildStoredQrUrl(stored) && process.env.NODE_ENV === 'development') {
    console.log('[QR REPAIR] replacing stale stored qr_payload', {
      assetTag: asset.asset_tag,
      previous: stored,
      next: verificationUrl,
      envBaseUrl: getAppBaseUrl() ?? null,
    });
  }
  const qr_generated_at = new Date().toISOString();

  const { error } = await updateAssetRow('id', asset.id, {
    serial_number,
    qr_payload,
    qr_generated_at,
  });

  if (error) throw new Error(error.message);

  return { serial_number, qr_payload, qr_generated_at };
}
