-- 022_assets_request_id.sql
-- Link registered assets back to originating asset requests (BRD fulfillment workflow).
-- Idempotent: safe if 011_brd_approval_workflow.sql was already applied.

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS request_id UUID REFERENCES public.asset_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_assets_request ON public.assets(request_id);

NOTIFY pgrst, 'reload schema';
