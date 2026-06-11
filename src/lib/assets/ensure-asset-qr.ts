import {
  buildAssetVerificationUrl,
  resolveSerialNumber,
  serializeAssetQrContent,
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
  asset: AssetQrFields
): Promise<AssetQrMetadata> {
  const serial_number = resolveSerialNumber(asset);
  const verificationUrl = buildAssetVerificationUrl(asset.asset_tag);
  const qr_payload = serializeAssetQrContent(verificationUrl);
  const qr_generated_at = new Date().toISOString();

  const { error } = await updateAssetRow('id', asset.id, {
    serial_number,
    qr_payload,
    qr_generated_at,
  });

  if (error) throw new Error(error.message);

  return { serial_number, qr_payload, qr_generated_at };
}
