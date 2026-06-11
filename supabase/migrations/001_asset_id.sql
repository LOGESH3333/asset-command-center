-- Migration: add UUID id to assets if missing (for maintenance_records FK)
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
UPDATE public.assets SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE public.assets ALTER COLUMN id SET NOT NULL;

-- Ensure maintenance_records.asset_id references assets.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'maintenance_records_asset_id_fkey'
  ) THEN
    ALTER TABLE public.maintenance_records
      ADD CONSTRAINT maintenance_records_asset_id_fkey
      FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;
