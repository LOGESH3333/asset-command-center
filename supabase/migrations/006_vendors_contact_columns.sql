-- Fix: vendors.contact_email / contact_phone / address missing on remote DB
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Drop legacy wrong column names if present
DO $$ BEGIN
  ALTER TABLE public.vendors DROP COLUMN IF EXISTS phone;
  ALTER TABLE public.vendors DROP COLUMN IF EXISTS email;
EXCEPTION WHEN others THEN NULL; END $$;

NOTIFY pgrst, 'reload schema';
