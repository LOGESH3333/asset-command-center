-- Fix RLS for demo/assessment mode + asset_allocations table
-- Run in Supabase SQL Editor AFTER schema.sql, 001, 002

-- ---------------------------------------------------------------------------
-- asset_allocations (assignment history; optional FK from assets)
-- ---------------------------------------------------------------------------
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

CREATE INDEX IF NOT EXISTS idx_allocations_asset ON public.asset_allocations(asset_id);
CREATE INDEX IF NOT EXISTS idx_allocations_user ON public.asset_allocations(user_id);

-- Ensure assets.id exists (from 001 migration)
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
UPDATE public.assets SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE public.assets ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Ensure vendor columns match app (contact_phone not phone)
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS address TEXT;

-- Ensure users columns match app
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'Employee';

-- ---------------------------------------------------------------------------
-- Audit trigger: run as definer, bypass RLS on audit_logs inserts
-- ---------------------------------------------------------------------------
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

-- Re-attach audit triggers
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY[
    'assets', 'asset_categories', 'vendors', 'asset_requests',
    'maintenance_records', 'users', 'asset_allocations'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%I ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.write_audit_log()',
      t, t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- RLS: permissive policies for demo (anon + authenticated)
-- Demo app login uses localStorage; Supabase client runs as anon role.
-- ---------------------------------------------------------------------------
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

DO $$ DECLARE tbl TEXT; BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'users',
    'asset_categories',
    'vendors',
    'assets',
    'asset_requests',
    'asset_allocations',
    'maintenance_records',
    'notifications',
    'audit_logs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format(
      'CREATE POLICY %I_demo_all ON public.%I
       FOR ALL TO anon, authenticated
       USING (true)
       WITH CHECK (true)',
      tbl, tbl
    );
  END LOOP;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
