-- 017_production_hardening.sql
-- Production hardening for Supabase-only authentication, RLS, invitations, and audit actor attribution.
-- Idempotent and safe to run after 016_remove_clerk_and_fix_auth.sql.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Normalize auth schema.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_id UUID;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Active';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND conname ILIKE '%clerk%'
  LOOP
    EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT IF EXISTS %I', rec.conname);
  END LOOP;

  FOR rec IN
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND indexname ILIKE '%clerk%'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', rec.indexname);
  END LOOP;
END $$;

ALTER TABLE public.users DROP COLUMN IF EXISTS clerk_id;

DO $$
BEGIN
  ALTER TABLE public.users ALTER COLUMN role TYPE TEXT USING role::text;
EXCEPTION WHEN others THEN
  NULL;
END $$;

UPDATE public.users u
SET auth_id = au.id
FROM auth.users au
WHERE u.auth_id IS NULL
  AND lower(trim(u.email)) = lower(trim(au.email));

UPDATE public.users
SET role = CASE
  WHEN role IN ('Super_Admin', 'Admin', 'Manager', 'Employee') THEN role
  WHEN role IN ('Procurement', 'Finance') THEN 'Admin'
  ELSE 'Employee'
END;

UPDATE public.users
SET status = CASE
  WHEN status IN ('Active', 'Pending', 'Suspended', 'Invited') THEN status
  WHEN status IS NULL OR trim(status) = '' THEN 'Active'
  ELSE 'Active'
END;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('Super_Admin', 'Admin', 'Manager', 'Employee'));

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_status_check
  CHECK (status IN ('Active', 'Pending', 'Suspended', 'Invited'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_auth_id_auth_users_fkey'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_auth_id_auth_users_fkey
      FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_auth_id_key;
ALTER TABLE public.users ADD CONSTRAINT users_auth_id_key UNIQUE (auth_id);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx
  ON public.users (lower(email))
  WHERE email IS NOT NULL AND email <> '';
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);

-- Notification readiness.
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read);

-- Remove permissive demo policies everywhere.
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        policyname ILIKE '%demo%'
        OR qual = 'true'
        OR with_check = 'true'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', rec.policyname, rec.schemaname, rec.tablename);
  END LOOP;
END $$;

-- Core helper functions.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
  SELECT role::text FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT public.current_user_role() = 'Super_Admin';
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.is_admin_or_above()
RETURNS BOOLEAN AS $$
  SELECT public.current_user_role() IN ('Super_Admin', 'Admin');
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, auth;

-- Profile RLS.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_select_own_or_admin ON public.users;
CREATE POLICY users_select_own_or_admin ON public.users
  FOR SELECT TO authenticated
  USING (
    auth_id = auth.uid()
    OR public.current_user_role() IN ('Super_Admin', 'Admin', 'Manager')
  );

DROP POLICY IF EXISTS users_update_own_or_super_admin ON public.users;
CREATE POLICY users_update_own_or_super_admin ON public.users
  FOR UPDATE TO authenticated
  USING (auth_id = auth.uid() OR public.is_super_admin())
  WITH CHECK (auth_id = auth.uid() OR public.is_super_admin());

-- Invitations are service-role only. The app accesses them through server actions.
CREATE TABLE IF NOT EXISTS public.user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'Employee',
  department TEXT,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_invitations_demo_all ON public.user_invitations;
DROP POLICY IF EXISTS user_invitations_service_only ON public.user_invitations;
CREATE POLICY user_invitations_service_only ON public.user_invitations
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.user_invitations FROM anon, authenticated;
GRANT ALL ON public.user_invitations TO service_role;

-- Auth trigger: link existing email rows first, then insert by auth_id.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  normalized_email TEXT;
  assigned_role TEXT;
BEGIN
  normalized_email := lower(trim(COALESCE(NEW.email, '')));
  IF normalized_email = '' THEN
    RETURN NEW;
  END IF;

  assigned_role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'Employee');
  IF assigned_role NOT IN ('Super_Admin', 'Admin', 'Manager', 'Employee') THEN
    assigned_role := 'Employee';
  END IF;

  UPDATE public.users
  SET
    auth_id = NEW.id,
    first_name = COALESCE(NULLIF(first_name, ''), COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(normalized_email, '@', 1))),
    last_name = COALESCE(NULLIF(last_name, ''), COALESCE(NEW.raw_user_meta_data->>'last_name', '')),
    department = COALESCE(department, NULLIF(NEW.raw_user_meta_data->>'department', '')),
    role = CASE WHEN role IN ('Super_Admin', 'Admin', 'Manager', 'Employee') THEN role ELSE assigned_role END,
    status = CASE WHEN status = 'Suspended' THEN status WHEN NEW.email_confirmed_at IS NULL THEN 'Pending' ELSE 'Active' END,
    updated_at = now()
  WHERE lower(trim(email)) = normalized_email
    AND (auth_id IS NULL OR auth_id = NEW.id);

  IF FOUND THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.users (
    auth_id, email, first_name, last_name, department, role, status
  )
  VALUES (
    NEW.id,
    normalized_email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(normalized_email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'department', ''),
    assigned_role,
    CASE WHEN NEW.email_confirmed_at IS NULL THEN 'Pending' ELSE 'Active' END
  )
  ON CONFLICT (auth_id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Audit actor attribution.
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);

CREATE OR REPLACE FUNCTION public.write_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec_id UUID;
  actor_id UUID;
BEGIN
  SELECT id INTO actor_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;

  IF TG_OP = 'DELETE' THEN
    rec_id := OLD.id;
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (actor_id, 'DELETE', TG_TABLE_NAME, rec_id, to_jsonb(OLD), NULL);
    RETURN OLD;
  END IF;

  rec_id := NEW.id;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (actor_id, 'INSERT', TG_TABLE_NAME, rec_id, NULL, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (actor_id, 'UPDATE', TG_TABLE_NAME, rec_id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

NOTIFY pgrst, 'reload schema';
