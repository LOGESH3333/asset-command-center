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
  const verbose = process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_AUTH_DEBUG === 'true';
  const isFailure =
    payload.error != null ||
    payload.step === 'FAILED' ||
    String(payload.step ?? '').includes('FAILED') ||
    String(payload.code ?? '').includes('failed');

  if (!verbose && !isFailure) return;

  const line = {
    projectRef: getAuthProjectRef(),
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    ...payload,
  };

  if (isFailure) {
    console.error(`[auth:${phase}]`, line);
    return;
  }

  console.log(`[auth:${phase}]`, line);
}

/** Production-safe login audit — never logs passwords. */
export function logLoginAudit(
  event: 'attempt' | 'auth_success' | 'auth_failure' | 'role_lookup' | 'login_complete',
  payload: {
    email: string;
    loginId?: string;
    authId?: string | null;
    role?: string | null;
    status?: string | null;
    reason?: string | null;
    step?: string | null;
  }
) {
  const line = {
    event,
    email: normalizeAuthEmail(payload.email),
    loginId: payload.loginId ?? null,
    authId: payload.authId ?? null,
    role: payload.role ?? null,
    status: payload.status ?? null,
    reason: payload.reason != null ? String(payload.reason) : null,
    step: payload.step ?? null,
    projectRef: getAuthProjectRef() ?? null,
  };

  const summary = [
    `[auth:login-audit] ${event}`,
    line.email,
    line.step ? `step=${line.step}` : null,
    line.reason ? `reason=${line.reason}` : null,
  ]
    .filter(Boolean)
    .join(' | ');

  // Expected login failures (bad password, blocked user) are not app errors — avoid
  // console.error so Next.js dev overlay does not surface them as runtime exceptions.
  if (event === 'auth_failure') {
    console.warn(summary);
    return;
  }

  console.log(summary, line);
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
