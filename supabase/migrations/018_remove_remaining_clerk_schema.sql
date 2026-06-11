-- 018_remove_remaining_clerk_schema.sql
-- Production-safe repair for legacy Clerk schema residue in public.users.
--
-- Root cause fixed by this migration:
-- public.users still has clerk_id NOT NULL plus users_clerk_id_key, so the
-- Supabase Auth on_auth_user_created trigger fails when creating users.
--
-- This script:
-- 1. Backs up existing public.users rows.
-- 2. Maps auth.users.id into public.users.auth_id by normalized email.
-- 3. Drops users_clerk_id_key and any Clerk-related constraints/indexes.
-- 4. Drops public.users.clerk_id.
-- 5. Recreates public.handle_new_user() and on_auth_user_created.
-- 6. Preserves existing roles and departments.
-- 7. Provides verification result sets at the end.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

BEGIN;

-- Backup existing users before any destructive schema change.
CREATE TABLE IF NOT EXISTS public.users_backup_before_clerk_removal (
  backup_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backed_up_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_user_id UUID,
  row_data JSONB NOT NULL
);

INSERT INTO public.users_backup_before_clerk_removal (source_user_id, row_data)
SELECT id, to_jsonb(u)
FROM public.users u
WHERE NOT EXISTS (
  SELECT 1
  FROM public.users_backup_before_clerk_removal b
  WHERE b.source_user_id = u.id
);

-- Ensure the Supabase-auth profile shape exists before the auth trigger runs.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_id UUID;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'Employee';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Active';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Convert legacy enum role columns to TEXT so Super_Admin can be stored.
DO $$
BEGIN
  ALTER TABLE public.users ALTER COLUMN role TYPE TEXT USING role::text;
EXCEPTION WHEN others THEN
  NULL;
END $$;

ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'Employee';
ALTER TABLE public.users ALTER COLUMN status SET DEFAULT 'Active';

-- Drop the known legacy Clerk unique constraint first.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_clerk_id_key;

-- Drop constraints that reference Clerk, even if the constraint name is not predictable.
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND (
        conname ILIKE '%clerk%'
        OR pg_get_constraintdef(oid) ILIKE '%clerk_id%'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT IF EXISTS %I', rec.conname);
  END LOOP;
END $$;

-- Drop indexes that reference Clerk, even if the index name is not predictable.
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND (
        indexname ILIKE '%clerk%'
        OR indexdef ILIKE '%clerk_id%'
      )
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', rec.indexname);
  END LOOP;
END $$;

-- Backfill auth_id by matching normalized email to auth.users.
-- This preserves existing public.users roles and departments.
UPDATE public.users u
SET auth_id = au.id
FROM auth.users au
WHERE u.auth_id IS NULL
  AND lower(trim(u.email)) = lower(trim(au.email));

-- Preserve profile rows while clearing stale links to deleted/nonexistent auth users.
UPDATE public.users u
SET auth_id = NULL,
    updated_at = now()
WHERE u.auth_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM auth.users au
    WHERE au.id = u.auth_id
  );

-- Normalize invalid roles/statuses only. Existing valid roles/departments are preserved.
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

-- This is the root repair: no Supabase-auth profile row should require clerk_id.
ALTER TABLE public.users DROP COLUMN IF EXISTS clerk_id;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('Super_Admin', 'Admin', 'Manager', 'Employee'));

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_status_check
  CHECK (status IN ('Active', 'Pending', 'Suspended', 'Invited'));

DO $$
DECLARE
  duplicate_auth_id UUID;
BEGIN
  SELECT auth_id INTO duplicate_auth_id
  FROM public.users
  WHERE auth_id IS NOT NULL
  GROUP BY auth_id
  HAVING COUNT(*) > 1
  LIMIT 1;

  IF duplicate_auth_id IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot add users_auth_id_key: duplicate public.users.auth_id value % exists', duplicate_auth_id;
  END IF;
END $$;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_auth_id_key;
ALTER TABLE public.users ADD CONSTRAINT users_auth_id_key UNIQUE (auth_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND conname = 'users_auth_id_auth_users_fkey'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_auth_id_auth_users_fkey
      FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx
  ON public.users (lower(email))
  WHERE email IS NOT NULL AND email <> '';
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);

-- Repair the auth trigger so new Supabase Auth users link existing email rows first,
-- then create public.users rows without any Clerk dependency. Existing role and
-- department values are preserved when a matching public.users row already exists.
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
    email = normalized_email,
    first_name = COALESCE(NULLIF(first_name, ''), COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(normalized_email, '@', 1))),
    last_name = COALESCE(NULLIF(last_name, ''), COALESCE(NEW.raw_user_meta_data->>'last_name', '')),
    department = COALESCE(department, NULLIF(NEW.raw_user_meta_data->>'department', '')),
    role = CASE
      WHEN role IN ('Super_Admin', 'Admin', 'Manager', 'Employee') THEN role
      ELSE assigned_role
    END,
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
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    department = EXCLUDED.department,
    role = EXCLUDED.role,
    status = CASE WHEN public.users.status = 'Suspended' THEN public.users.status ELSE EXCLUDED.status END,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Verification queries. These return result sets when run in Supabase SQL Editor.
-- 1. public.users should not contain clerk_id.
SELECT
  'clerk_id_removed' AS check_name,
  NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'clerk_id'
  ) AS passed;

-- 2. users_clerk_id_key should not exist.
SELECT
  'users_clerk_id_key_removed' AS check_name,
  NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND conname = 'users_clerk_id_key'
  ) AS passed;

-- 3. auth_id should be linked to auth.users where emails match.
SELECT
  'auth_id_email_mapping' AS check_name,
  COUNT(*) FILTER (
    WHERE u.auth_id = au.id
  ) AS linked_users,
  COUNT(*) AS matching_email_users
FROM public.users u
JOIN auth.users au
  ON lower(trim(u.email)) = lower(trim(au.email));

-- 4. handle_new_user should exist.
SELECT
  'handle_new_user_exists' AS check_name,
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'handle_new_user'
  ) AS passed;

-- 5. on_auth_user_created trigger should exist on auth.users.
SELECT
  'on_auth_user_created_trigger_exists' AS check_name,
  EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'auth.users'::regclass
      AND tgname = 'on_auth_user_created'
      AND NOT tgisinternal
  ) AS passed;
