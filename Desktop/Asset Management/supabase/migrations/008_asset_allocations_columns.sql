-- =============================================================================
-- Migration 008: Repair asset_allocations columns (idempotent)
-- Run in Supabase SQL Editor if allocations fail with:
--   column asset_allocations.allocated_at does not exist
--
-- Root cause: asset_allocations existed before migrations 003/007 ran.
-- CREATE TABLE IF NOT EXISTS does not add missing columns to existing tables.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Ensure base table exists (legacy deployments may have a partial table)
CREATE TABLE IF NOT EXISTS public.asset_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure assets.id exists for FK
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
UPDATE public.assets SET id = gen_random_uuid() WHERE id IS NULL;

-- Core allocation columns expected by the application
ALTER TABLE public.asset_allocations ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.asset_allocations ADD COLUMN IF NOT EXISTS allocated_at TIMESTAMPTZ;
ALTER TABLE public.asset_allocations ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ;
ALTER TABLE public.asset_allocations ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.asset_allocations ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE public.asset_allocations ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;
ALTER TABLE public.asset_allocations ADD COLUMN IF NOT EXISTS acknowledged_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Backfill from created_at where legacy rows lack allocation timestamps
UPDATE public.asset_allocations
SET allocated_at = COALESCE(allocated_at, created_at, now())
WHERE allocated_at IS NULL;

UPDATE public.asset_allocations
SET status = COALESCE(NULLIF(TRIM(status), ''), 'Active')
WHERE status IS NULL OR TRIM(status) = '';

-- Defaults (safe after backfill)
ALTER TABLE public.asset_allocations ALTER COLUMN allocated_at SET DEFAULT now();
ALTER TABLE public.asset_allocations ALTER COLUMN status SET DEFAULT 'Active';

-- Enforce NOT NULL only when no nulls remain
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.asset_allocations WHERE allocated_at IS NULL) THEN
    ALTER TABLE public.asset_allocations ALTER COLUMN allocated_at SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.asset_allocations WHERE status IS NULL) THEN
    ALTER TABLE public.asset_allocations ALTER COLUMN status SET NOT NULL;
  END IF;
END $$;

-- FK to assets (ignore if already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'asset_allocations_asset_id_fkey'
      AND conrelid = 'public.asset_allocations'::regclass
  ) THEN
    ALTER TABLE public.asset_allocations
      ADD CONSTRAINT asset_allocations_asset_id_fkey
      FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_allocations_asset ON public.asset_allocations(asset_id);
CREATE INDEX IF NOT EXISTS idx_allocations_user ON public.asset_allocations(user_id);
CREATE INDEX IF NOT EXISTS idx_allocations_status ON public.asset_allocations(status);

-- updated_at trigger (idempotent)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_asset_allocations_updated_at ON public.asset_allocations;
CREATE TRIGGER set_asset_allocations_updated_at
  BEFORE UPDATE ON public.asset_allocations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

NOTIFY pgrst, 'reload schema';
