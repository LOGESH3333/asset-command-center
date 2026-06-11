/** Canonical write_audit_log() — live audit_logs.record_id is UUID */

export const WRITE_AUDIT_LOG_FUNCTION_SQL = `
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
$$`.trim();

export const AUDIT_TRIGGER_REPAIR_SQL = `${WRITE_AUDIT_LOG_FUNCTION_SQL};\nNOTIFY pgrst, 'reload schema';`;
