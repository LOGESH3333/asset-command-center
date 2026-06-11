-- 020_approval_queue_rls.sql
-- Restore approval queue visibility after 017 removed permissive demo policies.
-- Idempotent: safe to run multiple times.

CREATE OR REPLACE FUNCTION public.is_approver_role()
RETURNS BOOLEAN AS $$
  SELECT public.current_user_role() IN ('Super_Admin', 'Admin', 'Manager');
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.is_request_requester(target_request_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.asset_requests ar
    JOIN public.users u ON u.id = ar.requester_id
    WHERE ar.id = target_request_id
      AND u.auth_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, auth;

ALTER TABLE public.request_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS request_approvals_select ON public.request_approvals;
CREATE POLICY request_approvals_select ON public.request_approvals
  FOR SELECT TO authenticated
  USING (
    public.is_approver_role()
    OR public.is_request_requester(request_id)
  );

DROP POLICY IF EXISTS asset_requests_select ON public.asset_requests;
CREATE POLICY asset_requests_select ON public.asset_requests
  FOR SELECT TO authenticated
  USING (
    public.is_approver_role()
    OR EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = asset_requests.requester_id
        AND u.auth_id = auth.uid()
    )
  );

-- Backfill Manager approval rows for in-flight requests (idempotent).
INSERT INTO public.request_approvals (request_id, approval_stage, status)
SELECT ar.id, 'Manager', 'Pending'
FROM public.asset_requests ar
WHERE ar.status IN ('Pending Manager', 'Pending Procurement', 'Pending Finance')
  AND NOT EXISTS (
    SELECT 1
    FROM public.request_approvals ra
    WHERE ra.request_id = ar.id
      AND ra.approval_stage = 'Manager'
  );

INSERT INTO public.request_approvals (request_id, approval_stage, status)
SELECT ar.id, 'Procurement', 'Pending'
FROM public.asset_requests ar
WHERE ar.status IN ('Pending Procurement', 'Pending Finance')
  AND NOT EXISTS (
    SELECT 1
    FROM public.request_approvals ra
    WHERE ra.request_id = ar.id
      AND ra.approval_stage = 'Procurement'
  );

INSERT INTO public.request_approvals (request_id, approval_stage, status)
SELECT ar.id, 'Finance', 'Pending'
FROM public.asset_requests ar
WHERE ar.status = 'Pending Finance'
  AND NOT EXISTS (
    SELECT 1
    FROM public.request_approvals ra
    WHERE ra.request_id = ar.id
      AND ra.approval_stage = 'Finance'
  );

NOTIFY pgrst, 'reload schema';
