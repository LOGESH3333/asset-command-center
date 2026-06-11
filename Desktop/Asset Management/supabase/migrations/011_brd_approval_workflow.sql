-- BRD approval workflow: link assets to requests, fulfillment tracking, approval uniqueness

ALTER TABLE public.asset_requests
  ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMPTZ;

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS request_id UUID REFERENCES public.asset_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_assets_request ON public.assets(request_id);
CREATE INDEX IF NOT EXISTS idx_requests_fulfilled ON public.asset_requests(fulfilled_at)
  WHERE fulfilled_at IS NOT NULL;

-- One pending approval per stage per request
CREATE UNIQUE INDEX IF NOT EXISTS idx_approvals_one_pending_per_stage
  ON public.request_approvals (request_id, approval_stage)
  WHERE status = 'Pending';

-- Backfill Manager approval rows for in-flight requests (idempotent)
INSERT INTO public.request_approvals (request_id, approval_stage, status)
SELECT ar.id, 'Manager', 'Pending'
FROM public.asset_requests ar
WHERE ar.status IN ('Pending Manager', 'Pending Procurement', 'Pending Finance')
  AND NOT EXISTS (
    SELECT 1 FROM public.request_approvals ra
    WHERE ra.request_id = ar.id AND ra.approval_stage = 'Manager'
  );

INSERT INTO public.request_approvals (request_id, approval_stage, status)
SELECT ar.id, 'Procurement', 'Pending'
FROM public.asset_requests ar
WHERE ar.status IN ('Pending Procurement', 'Pending Finance')
  AND NOT EXISTS (
    SELECT 1 FROM public.request_approvals ra
    WHERE ra.request_id = ar.id AND ra.approval_stage = 'Procurement'
  );

INSERT INTO public.request_approvals (request_id, approval_stage, status)
SELECT ar.id, 'Finance', 'Pending'
FROM public.asset_requests ar
WHERE ar.status = 'Pending Finance'
  AND NOT EXISTS (
    SELECT 1 FROM public.request_approvals ra
    WHERE ra.request_id = ar.id AND ra.approval_stage = 'Finance'
  );
