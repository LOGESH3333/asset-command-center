-- Extend application roles for enterprise RBAC (Procurement, Finance)
-- Safe for TEXT role column deployments

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('Admin', 'Manager', 'Employee', 'Procurement', 'Finance'));
