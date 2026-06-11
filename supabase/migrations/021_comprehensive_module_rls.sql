-- 021_comprehensive_module_rls.sql
-- Restore client-readable data for all modules after 017 removed demo_all policies.
-- SELECT-only for authenticated users; writes remain server-side via service role.

CREATE OR REPLACE FUNCTION public.is_allocation_participant(allocation_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = allocation_user_id
      AND u.auth_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, auth;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'asset_categories',
    'vendors',
    'assets',
    'maintenance_records',
    'inventory',
    'procurements',
    'purchase_orders',
    'asset_disposals'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_select ON public.%I FOR SELECT TO authenticated USING (true)',
      t, t
    );
  END LOOP;
END $$;

ALTER TABLE public.asset_allocations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS asset_allocations_select ON public.asset_allocations;
CREATE POLICY asset_allocations_select ON public.asset_allocations
  FOR SELECT TO authenticated
  USING (
    public.is_approver_role()
    OR public.is_admin_or_above()
    OR public.is_allocation_participant(user_id)
  );

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifications_select ON public.notifications;
CREATE POLICY notifications_select ON public.notifications
  FOR SELECT TO authenticated
  USING (
    user_id IS NULL
    OR public.is_admin_or_above()
    OR EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = notifications.user_id
        AND u.auth_id = auth.uid()
    )
  );

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_logs_select ON public.audit_logs;
CREATE POLICY audit_logs_select ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

NOTIFY pgrst, 'reload schema';
