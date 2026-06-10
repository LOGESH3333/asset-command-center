-- =============================================================================
-- Migration 009: Align write_audit_log() with live audit_logs schema
-- Live columns: id, user_id, action, table_name, record_id (UUID), old_data, new_data, created_at
-- Run in Supabase SQL Editor if inserts fail with:
--   column "details" of relation "audit_logs" does not exist
-- Then run 010_audit_logs_record_id_uuid.sql if record_id is UUID.
-- =============================================================================

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

NOTIFY pgrst, 'reload schema';
