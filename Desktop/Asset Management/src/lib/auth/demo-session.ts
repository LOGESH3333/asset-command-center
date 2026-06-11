import type { AppRole } from './roles';
import type { UserProfile } from './session';

export const DEMO_SESSION_KEY = 'demo_session';
export const DEMO_SESSION_COOKIE = 'demo_session';

export type DemoSession = {
  email: string;
  first_name: string;
  last_name: string;
  role: AppRole;
  loggedInAt: string;
};

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export function createDemoSession(input: {
  email: string;
  fullName?: string;
  role?: AppRole;
}): DemoSession {
  const email = input.email.trim().toLowerCase();
  const name = (input.fullName ?? email.split('@')[0] ?? 'Demo User').trim();
  const parts = name.split(/\s+/);
  const first_name = parts[0] ?? 'Demo';
  const last_name = parts.slice(1).join(' ') || 'User';

  return {
    email,
    first_name,
    last_name,
    role: input.role ?? 'Admin',
    loggedInAt: new Date().toISOString(),
  };
}

export function demoSessionToProfile(session: DemoSession): UserProfile {
  const now = new Date().toISOString();
  return {
    id: 'demo-user',
    auth_id: 'demo-user',
    email: session.email,
    first_name: session.first_name,
    last_name: session.last_name,
    department: 'Operations',
    role: session.role,
    created_at: session.loggedInAt,
    updated_at: now,
  };
}

/** Client: persist session in localStorage + cookie (for middleware). */
export function saveDemoSession(session: DemoSession): void {
  if (typeof window === 'undefined') return;
  const payload = JSON.stringify(session);
  localStorage.setItem(DEMO_SESSION_KEY, payload);
  document.cookie = `${DEMO_SESSION_COOKIE}=${encodeURIComponent(payload)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

/** Client: read session from localStorage. */
export function getDemoSession(): DemoSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DEMO_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DemoSession;
  } catch {
    return null;
  }
}

/** Client: clear demo session. */
export function clearDemoSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(DEMO_SESSION_KEY);
  document.cookie = `${DEMO_SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

export function hasDemoSessionClient(): boolean {
  return getDemoSession() !== null;
}

/** Server/middleware: parse demo session from cookie value. */
export function parseDemoSessionCookie(raw: string | undefined): DemoSession | null {
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw)) as DemoSession;
  } catch {
    try {
      return JSON.parse(raw) as DemoSession;
    } catch {
      return null;
    }
  }
}
