-- =============================================================================
-- Migration 019: Generic production-safe user delete FK cleanup
-- =============================================================================
-- Dynamically discovers every FK column that references public.users(id), nulls
-- nullable references, verifies cleanup, and reports blocking NOT NULL FKs.

CREATE OR REPLACE FUNCTION public.cleanup_user_delete_references(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  ref RECORD;
  referenced_rows INTEGER;
  remaining_rows INTEGER;
  cleanup_results JSONB := '[]'::jsonb;
BEGIN
  FOR ref IN
    SELECT
      con.conname AS constraint_name,
      ns.nspname AS table_schema,
      rel.relname AS table_name,
      att.attname AS column_name,
      NOT att.attnotnull AS column_nullable,
      CASE con.confdeltype
        WHEN 'a' THEN 'NO ACTION'
        WHEN 'r' THEN 'RESTRICT'
        WHEN 'c' THEN 'CASCADE'
        WHEN 'n' THEN 'SET NULL'
        WHEN 'd' THEN 'SET DEFAULT'
        ELSE con.confdeltype::text
      END AS on_delete_action
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    JOIN unnest(con.conkey) WITH ORDINALITY AS cols(attnum, ord) ON true
    JOIN unnest(con.confkey) WITH ORDINALITY AS refcols(attnum, ord) ON refcols.ord = cols.ord
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = cols.attnum
    JOIN pg_attribute refatt ON refatt.attrelid = con.confrelid AND refatt.attnum = refcols.attnum
    WHERE con.contype = 'f'
      AND con.confrelid = 'public.users'::regclass
      AND refatt.attname = 'id'
      AND ns.nspname NOT IN ('pg_catalog', 'information_schema')
    ORDER BY ns.nspname, rel.relname, con.conname, att.attname
  LOOP
    EXECUTE format(
      'SELECT COUNT(*)::int FROM %I.%I WHERE %I = $1',
      ref.table_schema,
      ref.table_name,
      ref.column_name
    )
    INTO referenced_rows
    USING target_user_id;

    IF referenced_rows = 0 THEN
      cleanup_results := cleanup_results || jsonb_build_array(jsonb_build_object(
        'constraintName', ref.constraint_name,
        'tableSchema', ref.table_schema,
        'tableName', ref.table_name,
        'columnName', ref.column_name,
        'columnNullable', ref.column_nullable,
        'onDeleteAction', ref.on_delete_action,
        'referencedRows', referenced_rows,
        'action', 'none'
      ));
      CONTINUE;
    END IF;

    IF NOT ref.column_nullable THEN
      RAISE EXCEPTION
        'Cannot delete user %. Blocking FK %.%.% via constraint % has % referencing row(s) and column is NOT NULL.',
        target_user_id,
        ref.table_schema,
        ref.table_name,
        ref.column_name,
        ref.constraint_name,
        referenced_rows
        USING ERRCODE = '23503';
    END IF;

    EXECUTE format(
      'UPDATE %I.%I SET %I = NULL WHERE %I = $1',
      ref.table_schema,
      ref.table_name,
      ref.column_name,
      ref.column_name
    )
    USING target_user_id;

    cleanup_results := cleanup_results || jsonb_build_array(jsonb_build_object(
      'constraintName', ref.constraint_name,
      'tableSchema', ref.table_schema,
      'tableName', ref.table_name,
      'columnName', ref.column_name,
      'columnNullable', ref.column_nullable,
      'onDeleteAction', ref.on_delete_action,
      'referencedRows', referenced_rows,
      'action', 'set_null'
    ));
  END LOOP;

  FOR ref IN
    SELECT
      con.conname AS constraint_name,
      ns.nspname AS table_schema,
      rel.relname AS table_name,
      att.attname AS column_name
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    JOIN unnest(con.conkey) WITH ORDINALITY AS cols(attnum, ord) ON true
    JOIN unnest(con.confkey) WITH ORDINALITY AS refcols(attnum, ord) ON refcols.ord = cols.ord
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = cols.attnum
    JOIN pg_attribute refatt ON refatt.attrelid = con.confrelid AND refatt.attnum = refcols.attnum
    WHERE con.contype = 'f'
      AND con.confrelid = 'public.users'::regclass
      AND refatt.attname = 'id'
      AND ns.nspname NOT IN ('pg_catalog', 'information_schema')
  LOOP
    EXECUTE format(
      'SELECT COUNT(*)::int FROM %I.%I WHERE %I = $1',
      ref.table_schema,
      ref.table_name,
      ref.column_name
    )
    INTO remaining_rows
    USING target_user_id;

    IF remaining_rows > 0 THEN
      RAISE EXCEPTION
        'Remaining user FK reference after cleanup: %.%.% via constraint % has % row(s).',
        ref.table_schema,
        ref.table_name,
        ref.column_name,
        ref.constraint_name,
        remaining_rows
        USING ERRCODE = '23503';
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'targetUserId', target_user_id,
    'cleanupResults', cleanup_results
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_user_delete_references(UUID) TO service_role;
