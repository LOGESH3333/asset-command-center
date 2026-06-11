-- =============================================================================
-- Asset Command Center — Enterprise Audit SQL Fixes
-- Run in Supabase Dashboard → SQL Editor → Run
-- Idempotent: safe to run multiple times
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 1: asset_allocations columns (Migration 008)
-- Resolves: column asset_allocations.allocated_at does not exist
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.asset_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
UPDATE public.assets SET id = gen_random_uuid() WHERE id IS NULL;

ALTER TABLE public.asset_allocations ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.asset_allocations ADD COLUMN IF NOT EXISTS allocated_at TIMESTAMPTZ;
ALTER TABLE public.asset_allocations ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ;
ALTER TABLE public.asset_allocations ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.asset_allocations ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE public.asset_allocations ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;
ALTER TABLE public.asset_allocations ADD COLUMN IF NOT EXISTS acknowledged_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

UPDATE public.asset_allocations
SET allocated_at = COALESCE(allocated_at, created_at, now())
WHERE allocated_at IS NULL;

UPDATE public.asset_allocations
SET status = COALESCE(NULLIF(TRIM(status), ''), 'Active')
WHERE status IS NULL OR TRIM(status) = '';

ALTER TABLE public.asset_allocations ALTER COLUMN allocated_at SET DEFAULT now();
ALTER TABLE public.asset_allocations ALTER COLUMN status SET DEFAULT 'Active';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.asset_allocations WHERE allocated_at IS NULL) THEN
    ALTER TABLE public.asset_allocations ALTER COLUMN allocated_at SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.asset_allocations WHERE status IS NULL) THEN
    ALTER TABLE public.asset_allocations ALTER COLUMN status SET NOT NULL;
  END IF;
END $$;

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
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_allocations_asset ON public.asset_allocations(asset_id);
CREATE INDEX IF NOT EXISTS idx_allocations_user ON public.asset_allocations(user_id);
CREATE INDEX IF NOT EXISTS idx_allocations_status ON public.asset_allocations(status);

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 2: asset_requests — align with application TypeScript types
-- Resolves: column asset_requests.justification does not exist
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.asset_requests ADD COLUMN IF NOT EXISTS justification TEXT;
ALTER TABLE public.asset_requests ADD COLUMN IF NOT EXISTS requester_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.asset_requests ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.asset_categories(id) ON DELETE SET NULL;
ALTER TABLE public.asset_requests ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.asset_requests ADD COLUMN IF NOT EXISTS procurement_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.asset_requests ADD COLUMN IF NOT EXISTS finance_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.asset_requests ADD COLUMN IF NOT EXISTS manager_approval_date TIMESTAMPTZ;
ALTER TABLE public.asset_requests ADD COLUMN IF NOT EXISTS procurement_approval_date TIMESTAMPTZ;
ALTER TABLE public.asset_requests ADD COLUMN IF NOT EXISTS finance_approval_date TIMESTAMPTZ;
ALTER TABLE public.asset_requests ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.asset_requests ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.asset_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill justification from legacy title/description columns
UPDATE public.asset_requests
SET justification = COALESCE(
  NULLIF(TRIM(justification), ''),
  NULLIF(TRIM(title), ''),
  NULLIF(TRIM(description), ''),
  'Untitled request'
)
WHERE justification IS NULL OR TRIM(justification) = '';

-- Backfill requester_id from legacy employee_id
UPDATE public.asset_requests
SET requester_id = employee_id
WHERE requester_id IS NULL AND employee_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_requests_requester ON public.asset_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_requests_category ON public.asset_requests(category_id);
CREATE INDEX IF NOT EXISTS idx_requests_justification ON public.asset_requests USING gin (to_tsvector('english', coalesce(justification, '')));

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 3: Ensure BRD module tables exist (Migration 007 excerpt — idempotent)
-- Skip if already applied via 007_brd_modules.sql
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.request_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.asset_requests(id) ON DELETE CASCADE,
  approver_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approval_stage TEXT NOT NULL CHECK (approval_stage IN ('Manager', 'Procurement', 'Finance')),
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  comments TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.procurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.asset_requests(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'Draft',
  priority TEXT NOT NULL DEFAULT 'Medium',
  requester_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  estimated_cost NUMERIC(12, 2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  procurement_id UUID REFERENCES public.procurements(id) ON DELETE SET NULL,
  po_number TEXT NOT NULL,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'Draft',
  total_amount NUMERIC(12, 2),
  order_date DATE,
  expected_delivery DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES public.asset_categories(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 0,
  unit_cost NUMERIC(12, 2),
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.asset_disposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  disposal_method TEXT,
  disposal_date DATE,
  recovered_value NUMERIC(12, 2),
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 4: updated_at trigger helper (idempotent)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Reload PostgREST schema cache
-- ─────────────────────────────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- VERIFICATION QUERIES (run separately after applying fixes)
-- =============================================================================
--
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'asset_allocations'
-- ORDER BY ordinal_position;
--
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'asset_requests'
-- ORDER BY ordinal_position;
--
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
--   AND table_name IN (
--     'users','assets','asset_categories','vendors','asset_requests',
--     'request_approvals','asset_allocations','maintenance_records',
--     'procurements','purchase_orders','inventory','asset_disposals',
--     'notifications','audit_logs'
--   )
-- ORDER BY table_name;
