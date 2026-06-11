-- 024_allocation_consistency_transaction.sql
-- Enforce allocation consistency:
--   asset_allocations row + assets.status='Allocated' must succeed/fail together.
-- Also repairs existing rows where assets.status='Allocated' but no active allocation exists.

CREATE OR REPLACE FUNCTION public.create_asset_allocation_transaction(
  p_asset_id UUID,
  p_user_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allocation_id UUID;
  v_asset_tag TEXT;
  v_user_exists BOOLEAN;
  v_allocated_at TIMESTAMPTZ := now();
BEGIN
  IF p_asset_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'Asset and employee are required.';
  END IF;

  SELECT asset_tag
  INTO v_asset_tag
  FROM public.assets
  WHERE id = p_asset_id
  FOR UPDATE;

  IF v_asset_tag IS NULL THEN
    RAISE EXCEPTION 'Selected asset was not found.';
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.users WHERE id = p_user_id)
  INTO v_user_exists;

  IF NOT v_user_exists THEN
    RAISE EXCEPTION 'Selected employee was not found.';
  END IF;

  SELECT id
  INTO v_allocation_id
  FROM public.asset_allocations
  WHERE asset_id = p_asset_id
    AND status = 'Active'
    AND returned_at IS NULL
  LIMIT 1;

  IF v_allocation_id IS NULL THEN
    INSERT INTO public.asset_allocations (
      asset_id,
      user_id,
      notes,
      status,
      allocated_at
    )
    VALUES (
      p_asset_id,
      p_user_id,
      NULLIF(TRIM(COALESCE(p_notes, '')), ''),
      'Active',
      v_allocated_at
    )
    RETURNING id INTO v_allocation_id;
  END IF;

  UPDATE public.assets
  SET
    assigned_employee_id = p_user_id,
    status = 'Allocated',
    updated_at = now()
  WHERE id = p_asset_id;

  IF NOT EXISTS (
    SELECT 1
    FROM public.audit_logs
    WHERE table_name = 'asset_allocations'
      AND record_id = v_allocation_id
  ) THEN
    INSERT INTO public.audit_logs (
      action,
      table_name,
      record_id,
      old_data,
      new_data
    )
    VALUES (
      'INSERT',
      'asset_allocations',
      v_allocation_id,
      NULL,
      jsonb_build_object(
        'id', v_allocation_id,
        'asset_id', p_asset_id,
        'user_id', p_user_id,
        'asset_tag', v_asset_tag,
        'notes', NULLIF(TRIM(COALESCE(p_notes, '')), ''),
        'status', 'Active',
        'allocated_at', v_allocated_at
      )
    );
  END IF;

  RETURN v_allocation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_asset_allocation_transaction(UUID, UUID, TEXT)
  TO anon, authenticated, service_role;

-- Repair existing inconsistent allocated assets with an assigned employee.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT a.id, a.assigned_employee_id, a.asset_tag
    FROM public.assets a
    WHERE a.status = 'Allocated'
      AND a.assigned_employee_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.asset_allocations aa
        WHERE aa.asset_id = a.id
          AND aa.status = 'Active'
          AND aa.returned_at IS NULL
      )
  LOOP
    PERFORM public.create_asset_allocation_transaction(
      r.id,
      r.assigned_employee_id,
      'Backfilled missing allocation for inconsistent asset status (' || r.asset_tag || ')'
    );
  END LOOP;
END $$;

-- If an asset is marked Allocated but has no employee and no allocation, it is not allocated.
UPDATE public.assets a
SET status = 'Available',
    updated_at = now()
WHERE a.status = 'Allocated'
  AND a.assigned_employee_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.asset_allocations aa
    WHERE aa.asset_id = a.id
      AND aa.status = 'Active'
      AND aa.returned_at IS NULL
  );

NOTIFY pgrst, 'reload schema';
