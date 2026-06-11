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

export type AuthLogPhase =
  | 'signup'
  | 'login'
  | 'signup-server'
  | 'password-reset-request'
  | 'password-reset-callback'
  | 'password-reset-update'
  | 'profile-sync';

export function logAuthEvent(phase: AuthLogPhase, payload: AuthLogPayload) {
  const debug = process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_AUTH_DEBUG === 'true';
  if (!debug) return;

  console.log(`[auth:${phase}]`, {
    projectRef: getAuthProjectRef(),
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    ...payload,
  });
}

type AuthErrorLike = {
  message?: string;
  name?: string;
  status?: number;
  code?: string;
};

export function serializeAuthError(error: AuthErrorLike | null | undefined) {
  if (!error) return null;
  return {
    message: error.message ?? 'Unknown auth error',
    name: error.name,
    status: error.status,
    code: 'code' in error ? (error as { code?: string }).code : undefined,
  };
}

export function serializeUnknownError(error: unknown) {
  if (!error) return null;
  if (typeof error === 'string') return { message: error };
  if (error instanceof Error) {
    return {
      ...serializeAuthError(error as AuthErrorLike),
      stack: error.stack,
    };
  }
  if (typeof error === 'object') {
    return serializeAuthError(error as AuthErrorLike);
  }
  return { message: String(error) };
}

export function serializeLoginPayload(payload: unknown): unknown {
  if (payload == null || typeof payload !== 'object') return payload;
  const record = { ...(payload as Record<string, unknown>) };
  if ('error' in record) {
    record.error = serializeUnknownError(record.error);
  }
  return record;
}

export function logLoginStep(
  loginId: string,
  step: string,
  phase: 'START' | 'SUCCESS' | 'FAILED',
  payload?: unknown
) {
  const message = `[LOGIN:${loginId}] ${step} ${phase}`;
  const details = payload === undefined ? '' : serializeLoginPayload(payload);
  if (phase === 'FAILED') {
    console.warn(message, details);
    return;
  }
  console.log(message, details);
}

export function isAuthSessionMissingError(error: { name?: string; message?: string } | null | undefined) {
  if (!error) return false;
  return (
    error.name === 'AuthSessionMissingError' ||
    (error.message?.toLowerCase().includes('auth session missing') ?? false)
  );
}
