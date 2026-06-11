-- Enterprise RBAC + user invitations + profile columns

-- Ensure users table has required auth columns
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'Employee';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Active';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Unique email when present
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON public.users (lower(email)) WHERE email IS NOT NULL AND email <> '';

-- Role constraint (enterprise + legacy roles)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('Super_Admin', 'Admin', 'Manager', 'Employee', 'Procurement', 'Finance'));

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_status_check
  CHECK (status IN ('Active', 'Pending', 'Suspended', 'Invited'));

-- Invitations
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
  auth_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_invitations_role_check
    CHECK (role IN ('Admin', 'Manager', 'Employee')),
  CONSTRAINT user_invitations_email_unique UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON public.user_invitations(token);
CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON public.user_invitations(lower(email));

-- RLS for invitations (service role used server-side; read own pending via token on activate page)
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_invitations' AND policyname = 'user_invitations_demo_all'
  ) THEN
    CREATE POLICY user_invitations_demo_all ON public.user_invitations
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON public.user_invitations TO anon, authenticated;

-- Updated trigger: link by email, first user Super_Admin only when no users exist
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  assigned_role TEXT;
  user_count INTEGER;
  normalized_email TEXT;
BEGIN
  normalized_email := lower(trim(COALESCE(NEW.email, '')));

  UPDATE public.users
  SET
    auth_id = NEW.id,
    email = normalized_email,
    first_name = COALESCE(NULLIF(first_name, ''), COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(normalized_email, '@', 1))),
    last_name = COALESCE(NULLIF(last_name, ''), COALESCE(NEW.raw_user_meta_data->>'last_name', '')),
    department = COALESCE(department, NULLIF(NEW.raw_user_meta_data->>'department', '')),
    status = COALESCE(NULLIF(status, ''), 'Active'),
    updated_at = now()
  WHERE lower(email) = normalized_email
    AND (auth_id IS NULL OR auth_id = NEW.id);

  IF FOUND THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO user_count FROM public.users;

  IF user_count = 0 THEN
    assigned_role := 'Super_Admin';
  ELSE
    assigned_role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'Employee');
  END IF;

  INSERT INTO public.users (auth_id, email, first_name, last_name, department, role, status)
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
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
