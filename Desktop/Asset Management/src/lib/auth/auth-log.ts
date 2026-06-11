/** Auth diagnostics — logs to console in development and when NEXT_PUBLIC_AUTH_DEBUG=true */

export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getAuthProjectRef(): string | undefined {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match?.[1];
}

type AuthLogPayload = Record<string, unknown>;

export function logAuthEvent(phase: 'signup' | 'login' | 'signup-server', payload: AuthLogPayload) {
  const debug = process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_AUTH_DEBUG === 'true';
  if (!debug) return;

  console.log(`[auth:${phase}]`, {
    projectRef: getAuthProjectRef(),
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    ...payload,
  });
}

export function serializeAuthError(error: { message?: string; name?: string; status?: number; code?: string } | null) {
  if (!error) return null;
  return {
    message: error.message,
    name: error.name,
    status: error.status,
    code: 'code' in error ? (error as { code?: string }).code : undefined,
  };
}
