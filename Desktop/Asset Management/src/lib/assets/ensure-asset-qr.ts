import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  buildAssetVerificationUrl,
  getAppBaseUrl,
  resolveSerialNumber,
  serializeAssetQrContent,
  type AssetQrFields,
} from './qr-code';

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
  const verificationUrl = buildAssetVerificationUrl(asset.asset_tag, getAppBaseUrl());
  const qr_payload = serializeAssetQrContent(verificationUrl);
  const qr_generated_at = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from('assets')
    .update({ serial_number, qr_payload, qr_generated_at })
    .eq('id', asset.id);

  if (error) throw new Error(error.message);

  return { serial_number, qr_payload, qr_generated_at };
}
