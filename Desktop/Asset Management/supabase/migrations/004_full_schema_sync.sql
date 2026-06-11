-- Full schema sync: align remote DB with application code
-- Run in Supabase SQL Editor AFTER migrations 001, 002, 003

-- ─── USERS ───
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'Employee';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ─── ASSET CATEGORIES ───
CREATE TABLE IF NOT EXISTS public.asset_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── VENDORS (contact_phone NOT phone) ───
CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS address TEXT;

-- Drop legacy phone column if it exists (wrong name)
DO $$ BEGIN
  ALTER TABLE public.vendors DROP COLUMN IF EXISTS phone;
EXCEPTION WHEN others THEN NULL; END $$;

-- ─── ASSETS ───
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
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Available';
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ─── ASSET ALLOCATIONS ───
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

-- ─── ASSET REQUESTS (fix missing description) ───
CREATE TABLE IF NOT EXISTS public.asset_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'Pending',
  priority TEXT NOT NULL DEFAULT 'Medium',
  employee_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.asset_requests ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.asset_requests ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.asset_requests ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Pending';
ALTER TABLE public.asset_requests ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'Medium';
ALTER TABLE public.asset_requests ADD COLUMN IF NOT EXISTS employee_id UUID;
ALTER TABLE public.asset_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.asset_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ─── MAINTENANCE RECORDS ───
CREATE TABLE IF NOT EXISTS public.maintenance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'Preventive',
  description TEXT NOT NULL DEFAULT '',
  cost NUMERIC(12, 2),
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  scheduled_date DATE,
  completed_date DATE,
  performed_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'Preventive';
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS cost NUMERIC(12, 2);
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS vendor_id UUID;
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS scheduled_date DATE;
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS completed_date DATE;
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS performed_by TEXT;
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS notes TEXT;

-- ─── NOTIFICATIONS ───
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── AUDIT LOGS ───
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_assets_status ON public.assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_category ON public.assets(category_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON public.asset_requests(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_asset ON public.maintenance_records(asset_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_allocations_asset ON public.asset_allocations(asset_id);

-- Re-apply demo RLS (anon + authenticated full access)
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename); END LOOP;
END $$;

DO $$ DECLARE tbl TEXT; BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'users','asset_categories','vendors','assets','asset_requests',
    'asset_allocations','maintenance_records','notifications','audit_logs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format(
      'CREATE POLICY %I_demo_all ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)',
      tbl, tbl
    );
  END LOOP;
END $$;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
