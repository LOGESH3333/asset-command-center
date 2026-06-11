-- 025_allocation_allocated_by_fix.sql
-- Live asset_allocations has a legacy NOT NULL column "allocated_by" that the app never set,
-- which blocked every allocation insert (error 23502).
-- Fix: make the column nullable and have the allocation transaction populate it.
-- Idempotent and safe to run repeatedly.

-- 1) Relax the legacy NOT NULL constraint if the column exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'asset_allocations'
      AND column_name = 'allocated_by'
  ) THEN
    BEGIN
      ALTER TABLE public.asset_allocations ALTER COLUMN allocated_by DROP NOT NULL;
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END IF;
END $$;

-- 2) Recreate the allocation transaction so it also populates allocated_by when the column exists.
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
  v_has_allocated_by BOOLEAN;
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

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'asset_allocations'
      AND column_name = 'allocated_by'
  )
  INTO v_has_allocated_by;

  SELECT id
  INTO v_allocation_id
  FROM public.asset_allocations
  WHERE asset_id = p_asset_id
    AND status = 'Active'
    AND returned_at IS NULL
  LIMIT 1;

  IF v_allocation_id IS NULL THEN
    IF v_has_allocated_by THEN
      EXECUTE
        'INSERT INTO public.asset_allocations
           (asset_id, user_id, notes, status, allocated_at, allocated_by)
         VALUES ($1, $2, $3, ''Active'', $4, $2)
         RETURNING id'
      INTO v_allocation_id
      USING p_asset_id, p_user_id, NULLIF(TRIM(COALESCE(p_notes, '')), ''), v_allocated_at;
    ELSE
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

NOTIFY pgrst, 'reload schema';
