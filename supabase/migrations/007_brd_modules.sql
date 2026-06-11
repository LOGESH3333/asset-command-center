-- =============================================================================
-- Migration 007: BRD modules (run in Supabase SQL Editor)
-- Creates: request_approvals, procurements, purchase_orders, inventory,
--          asset_disposals
-- Extends: asset_allocations (status, acknowledgment columns)
-- Requires: users, asset_requests, assets, vendors, asset_categories,
--           audit_logs (from base schema / migrations 001–006)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Prerequisite helpers (idempotent) ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.write_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    rec_id := OLD.id;
    INSERT INTO public.audit_logs (action, table_name, record_id, old_data, new_data)
    VALUES ('DELETE', TG_TABLE_NAME, rec_id, to_jsonb(OLD), NULL);
    RETURN OLD;
  END IF;

  rec_id := NEW.id;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (action, table_name, record_id, old_data, new_data)
    VALUES ('INSERT', TG_TABLE_NAME, rec_id, NULL, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (action, table_name, record_id, old_data, new_data)
    VALUES ('UPDATE', TG_TABLE_NAME, rec_id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

-- Ensure assets.id exists for disposal FK (compatible with legacy deployments)
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
UPDATE public.assets SET id = gen_random_uuid() WHERE id IS NULL;

-- ─── Asset allocations (base table + BRD extensions) ─────────────────────────

CREATE TABLE IF NOT EXISTS public.asset_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  allocated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  returned_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.asset_allocations ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Active';
ALTER TABLE public.asset_allocations ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;
ALTER TABLE public.asset_allocations ADD COLUMN IF NOT EXISTS acknowledged_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- ─── request_approvals ───────────────────────────────────────────────────────

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

-- ─── procurements (must exist before purchase_orders) ────────────────────────

CREATE TABLE IF NOT EXISTS public.procurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.asset_requests(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Submitted', 'Approved', 'Ordered', 'Closed', 'Cancelled')),
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High')),
  requester_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  estimated_cost NUMERIC(12, 2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── purchase_orders ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  procurement_id UUID REFERENCES public.procurements(id) ON DELETE SET NULL,
  po_number TEXT NOT NULL UNIQUE,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  total_amount NUMERIC(12, 2),
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Received', 'Cancelled')),
  order_date DATE,
  expected_delivery DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── inventory ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  category_id UUID REFERENCES public.asset_categories(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  quantity_on_hand INTEGER NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  reorder_level INTEGER NOT NULL DEFAULT 0,
  unit_cost NUMERIC(12, 2),
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── asset_disposals ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.asset_disposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  disposal_method TEXT CHECK (disposal_method IN ('Recycle', 'Donate', 'Sell', 'Destroy', 'Other')),
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Completed', 'Rejected')),
  requested_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  disposal_date DATE,
  salvage_value NUMERIC(12, 2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_allocations_asset ON public.asset_allocations(asset_id);
CREATE INDEX IF NOT EXISTS idx_allocations_user ON public.asset_allocations(user_id);
CREATE INDEX IF NOT EXISTS idx_allocations_status ON public.asset_allocations(status);

CREATE INDEX IF NOT EXISTS idx_approvals_request ON public.request_approvals(request_id);
CREATE INDEX IF NOT EXISTS idx_approvals_stage ON public.request_approvals(approval_stage);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON public.request_approvals(status);
CREATE INDEX IF NOT EXISTS idx_approvals_approver ON public.request_approvals(approver_id);

CREATE INDEX IF NOT EXISTS idx_procurements_status ON public.procurements(status);
CREATE INDEX IF NOT EXISTS idx_procurements_request ON public.procurements(request_id);
CREATE INDEX IF NOT EXISTS idx_procurements_vendor ON public.procurements(vendor_id);
CREATE INDEX IF NOT EXISTS idx_procurements_requester ON public.procurements(requester_id);

CREATE INDEX IF NOT EXISTS idx_po_number ON public.purchase_orders(po_number);
CREATE INDEX IF NOT EXISTS idx_po_status ON public.purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_procurement ON public.purchase_orders(procurement_id);
CREATE INDEX IF NOT EXISTS idx_po_vendor ON public.purchase_orders(vendor_id);

CREATE INDEX IF NOT EXISTS idx_inventory_sku ON public.inventory(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON public.inventory(category_id);
CREATE INDEX IF NOT EXISTS idx_inventory_vendor ON public.inventory(vendor_id);
CREATE INDEX IF NOT EXISTS idx_inventory_low ON public.inventory(quantity_on_hand);

CREATE INDEX IF NOT EXISTS idx_disposals_asset ON public.asset_disposals(asset_id);
CREATE INDEX IF NOT EXISTS idx_disposals_status ON public.asset_disposals(status);
CREATE INDEX IF NOT EXISTS idx_disposals_requested_by ON public.asset_disposals(requested_by);

-- ─── updated_at triggers ─────────────────────────────────────────────────────

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'asset_allocations',
    'request_approvals',
    'procurements',
    'purchase_orders',
    'inventory',
    'asset_disposals'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_%I_updated_at ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER set_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      t, t
    );
  END LOOP;
END $$;

-- ─── Audit triggers ──────────────────────────────────────────────────────────

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'asset_allocations',
    'request_approvals',
    'procurements',
    'purchase_orders',
    'inventory',
    'asset_disposals'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%I ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.write_audit_log()',
      t, t
    );
  END LOOP;
END $$;

-- ─── Demo RLS (permissive — replace for production) ───────────────────────────

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'asset_allocations',
    'request_approvals',
    'procurements',
    'purchase_orders',
    'inventory',
    'asset_disposals'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_demo_all ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY %I_demo_all ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ─── Grants + PostgREST schema reload ────────────────────────────────────────

GRANT ALL ON public.asset_allocations TO anon, authenticated;
GRANT ALL ON public.request_approvals TO anon, authenticated;
GRANT ALL ON public.procurements TO anon, authenticated;
GRANT ALL ON public.purchase_orders TO anon, authenticated;
GRANT ALL ON public.inventory TO anon, authenticated;
GRANT ALL ON public.asset_disposals TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
