-- Supabase Auth migration
-- Run in Supabase SQL Editor after schema.sql

-- Simplified role enum: Admin, Manager, Employee
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('Admin', 'Manager', 'Employee');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add auth_id column for Supabase Auth profile linkage
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;

-- Migrate role column if using old enum
DO $$ BEGIN
  ALTER TABLE public.users ALTER COLUMN role TYPE TEXT;
EXCEPTION WHEN others THEN NULL; END $$;

ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'Employee';

-- Sync profile on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (auth_id, email, first_name, last_name, department, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(COALESCE(NEW.email, ''), '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'department', ''),
    'Employee'
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Role helper for RLS
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
  SELECT role::text FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT public.current_user_role() = 'Admin';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS BOOLEAN AS $$
  SELECT public.current_user_role() IN ('Admin', 'Manager');
$$ LANGUAGE sql SECURITY DEFINER STABLE;
