/** Detect PostgREST errors when users.auth_id has not been migrated yet. */
export function isMissingAuthIdColumnError(error: { message?: string } | null | undefined): boolean {
  const msg = error?.message?.toLowerCase() ?? '';
  return msg.includes('auth_id') && msg.includes('does not exist');
}

export function isLegacyRequiredColumnError(error: { message?: string } | null | undefined): boolean {
  const msg = error?.message?.toLowerCase() ?? '';
  return msg.includes('violates not-null constraint') && msg.includes('users');
}

export const USER_AUTH_SCHEMA_REPAIR_SQL = [
  `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE`,
  `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT`,
  `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_name TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS department TEXT`,
  `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'Employee'`,
  `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Active'`,
  `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ`,
  `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()`,
  `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`,
  `DO $$ DECLARE rec RECORD; BEGIN
    FOR rec IN
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public.users'::regclass
        AND conname ILIKE '%clerk%'
    LOOP
      EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT IF EXISTS %I', rec.conname);
    END LOOP;

    FOR rec IN
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'users'
        AND indexname ILIKE '%clerk%'
    LOOP
      EXECUTE format('DROP INDEX IF EXISTS public.%I', rec.indexname);
    END LOOP;
  END $$`,
  `ALTER TABLE public.users DROP COLUMN IF EXISTS clerk_id`,
  `DO $$ BEGIN ALTER TABLE public.users ALTER COLUMN role TYPE TEXT USING role::text; EXCEPTION WHEN others THEN NULL; END $$`,
  `ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check`,
  `ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('Super_Admin', 'Admin', 'Manager', 'Employee'))`,
  `ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_status_check`,
  `ALTER TABLE public.users ADD CONSTRAINT users_status_check CHECK (status IN ('Active', 'Pending', 'Suspended', 'Invited'))`,
  `CREATE TABLE IF NOT EXISTS public.user_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL DEFAULT '',
    last_name TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'Employee',
    department TEXT,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    auth_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON public.user_invitations(token)`,
  `NOTIFY pgrst, 'reload schema'`,
];
