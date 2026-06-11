-- 023_assets_schema_sync.sql
-- Align public.assets with application Asset type + createAssetAction payload.
-- Idempotent — safe to run multiple times on live Supabase.

-- ─── Core columns ───────────────────────────────────────────────────────────
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
UPDATE public.assets SET id = gen_random_uuid() WHERE id IS NULL;

ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS asset_tag TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS category_id UUID;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS vendor_id UUID;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS assigned_employee_id UUID;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS cost NUMERIC(12, 2);
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS purchase_date DATE;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS warranty_expiry DATE;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Available';
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ─── BRD workflow link ──────────────────────────────────────────────────────
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS request_id UUID;

-- ─── QR / serial tagging ────────────────────────────────────────────────────
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS serial_number TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS qr_payload TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS qr_generated_at TIMESTAMPTZ;

-- ─── Foreign keys (skip if already present) ─────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assets_category_id_fkey') THEN
    ALTER TABLE public.assets
      ADD CONSTRAINT assets_category_id_fkey
      FOREIGN KEY (category_id) REFERENCES public.asset_categories(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assets_vendor_id_fkey') THEN
    ALTER TABLE public.assets
      ADD CONSTRAINT assets_vendor_id_fkey
      FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assets_assigned_employee_id_fkey') THEN
    ALTER TABLE public.assets
      ADD CONSTRAINT assets_assigned_employee_id_fkey
      FOREIGN KEY (assigned_employee_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assets_request_id_fkey') THEN
    ALTER TABLE public.assets
      ADD CONSTRAINT assets_request_id_fkey
      FOREIGN KEY (request_id) REFERENCES public.asset_requests(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ─── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_assets_request ON public.assets(request_id);
CREATE INDEX IF NOT EXISTS idx_assets_serial ON public.assets(serial_number)
  WHERE serial_number IS NOT NULL;

-- ─── Backfill ───────────────────────────────────────────────────────────────
UPDATE public.assets
SET serial_number = asset_tag
WHERE serial_number IS NULL OR TRIM(serial_number) = '';

UPDATE public.assets
SET status = 'Available'
WHERE status IS NULL OR TRIM(status) = '';

NOTIFY pgrst, 'reload schema';
