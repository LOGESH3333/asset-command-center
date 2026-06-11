-- Assessment/demo RLS policies
-- Run AFTER schema.sql and migrations 001, 002, 003
-- Allows anon + authenticated full CRUD (required for demo localStorage auth)

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
