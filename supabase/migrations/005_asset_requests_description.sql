-- Fix: asset_requests.description missing on remote DB + refresh PostgREST schema cache
ALTER TABLE public.asset_requests ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.asset_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Reload PostgREST schema cache so API sees the new column immediately
NOTIFY pgrst, 'reload schema';
