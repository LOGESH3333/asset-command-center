-- Profile sync: link auth users to existing rows, assign Admin to first user

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  assigned_role TEXT;
  user_count INTEGER;
  normalized_email TEXT;
BEGIN
  normalized_email := lower(trim(COALESCE(NEW.email, '')));

  -- Link orphaned profile rows (demo seed uses auth_id = NULL)
  UPDATE public.users
  SET
    auth_id = NEW.id,
    email = normalized_email,
    first_name = COALESCE(NULLIF(first_name, ''), COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(normalized_email, '@', 1))),
    last_name = COALESCE(NULLIF(last_name, ''), COALESCE(NEW.raw_user_meta_data->>'last_name', '')),
    department = COALESCE(department, NULLIF(NEW.raw_user_meta_data->>'department', '')),
    updated_at = now()
  WHERE lower(email) = normalized_email
    AND (auth_id IS NULL OR auth_id = NEW.id);

  IF FOUND THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO user_count FROM public.users;

  IF user_count = 0 THEN
    assigned_role := 'Admin';
  ELSE
    assigned_role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'Employee');
  END IF;

  INSERT INTO public.users (auth_id, email, first_name, last_name, department, role)
  VALUES (
    NEW.id,
    normalized_email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(normalized_email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'department', ''),
    assigned_role
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

-- Authenticated users can read their own profile (production RLS)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'users_select_own'
  ) THEN
    CREATE POLICY users_select_own ON public.users
      FOR SELECT TO authenticated
      USING (auth_id = auth.uid());
  END IF;
END $$;
