-- Enterprise asset QR tagging: serial number + stored payload metadata

ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS serial_number TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS qr_payload TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS qr_generated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_assets_serial ON public.assets(serial_number)
  WHERE serial_number IS NOT NULL;

-- Default serial to asset tag for legacy rows
UPDATE public.assets
SET serial_number = asset_tag
WHERE serial_number IS NULL OR TRIM(serial_number) = '';

-- Backfill QR JSON payload for existing assets
UPDATE public.assets
SET
  qr_payload = json_build_object(
    'id', id::text,
    'name', COALESCE(name, asset_tag),
    'tag', asset_tag,
    'serial', COALESCE(NULLIF(TRIM(serial_number), ''), asset_tag)
  )::text,
  qr_generated_at = COALESCE(qr_generated_at, now())
WHERE qr_payload IS NULL OR TRIM(qr_payload) = '';
