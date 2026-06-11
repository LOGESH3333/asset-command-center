-- 016_remove_clerk_and_fix_auth.sql
-- Standardize authentication on Supabase Auth.
-- Safe to run multiple times.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Ensure required public.users columns exist.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_id UUID;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Active';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Convert legacy enum role columns to TEXT before adding the enterprise role check.
DO $$
BEGIN
  ALTER TABLE public.users ALTER COLUMN role TYPE TEXT USING role::text;
EXCEPTION WHEN others THEN
  NULL;
END $$;

ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'Employee';

UPDATE public.users
SET role = CASE
  WHEN lower(trim(email)) = 'admin@123gmail.com' THEN 'Super_Admin'
  WHEN role IN ('Super_Admin', 'Admin', 'Manager', 'Employee') THEN role
  WHEN role IN ('Procurement', 'Finance') THEN 'Admin'
  ELSE 'Employee'
END;

-- Link existing profile rows to auth.users by normalized email.
UPDATE public.users u
SET auth_id = au.id
FROM auth.users au
WHERE u.auth_id IS NULL
  AND lower(trim(u.email)) = lower(trim(au.email));

-- Remove legacy auth constraints/indexes before dropping the column.
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

ALTER TABLE public.users ALTER COLUMN auth_id DROP NOT NULL;
ALTER TABLE public.users DROP COLUMN IF EXISTS clerk_id;

-- Constraints and indexes.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_auth_id_key;
ALTER TABLE public.users ADD CONSTRAINT users_auth_id_key UNIQUE (auth_id);

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('Super_Admin', 'Admin', 'Manager', 'Employee'));

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_status_check
  CHECK (status IN ('Active', 'Pending', 'Suspended', 'Invited'));

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx
  ON public.users (lower(email))
  WHERE email IS NOT NULL AND email <> '';

CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);

-- Invitations.
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_invitations_role_check CHECK (role IN ('Admin', 'Manager', 'Employee'))
);

CREATE UNIQUE INDEX IF NOT EXISTS user_invitations_email_unique_idx
  ON public.user_invitations (lower(email));
CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON public.user_invitations(token);
CREATE INDEX IF NOT EXISTS idx_user_invitations_auth_id ON public.user_invitations(auth_id);

-- Auth trigger: every Supabase auth user gets/links exactly one profile row.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  normalized_email TEXT;
  assigned_role TEXT;
  profile_count INTEGER;
BEGIN
  normalized_email := lower(trim(COALESCE(NEW.email, '')));

  IF normalized_email = '' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO profile_count FROM public.users;

  assigned_role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'Employee');

  IF assigned_role NOT IN ('Super_Admin', 'Admin', 'Manager', 'Employee') THEN
    assigned_role := 'Employee';
  END IF;

  IF profile_count = 0 THEN
    assigned_role := 'Super_Admin';
  END IF;

  INSERT INTO public.users (
    auth_id,
    email,
    first_name,
    last_name,
    department,
    role,
    status
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
    first_name = COALESCE(NULLIF(public.users.first_name, ''), EXCLUDED.first_name),
    last_name = COALESCE(NULLIF(public.users.last_name, ''), EXCLUDED.last_name),
    department = COALESCE(public.users.department, EXCLUDED.department),
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
  SELECT role::text FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, auth;

-- RLS baseline.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND policyname = 'users_select_own_or_admin'
  ) THEN
    CREATE POLICY users_select_own_or_admin ON public.users
      FOR SELECT TO authenticated
      USING (
        auth_id = auth.uid()
        OR public.current_user_role() IN ('Super_Admin', 'Admin', 'Manager')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND policyname = 'users_update_own_or_super_admin'
  ) THEN
    CREATE POLICY users_update_own_or_super_admin ON public.users
      FOR UPDATE TO authenticated
      USING (auth_id = auth.uid() OR public.current_user_role() = 'Super_Admin')
      WITH CHECK (auth_id = auth.uid() OR public.current_user_role() = 'Super_Admin');
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_invitations TO authenticated;

NOTIFY pgrst, 'reload schema';
