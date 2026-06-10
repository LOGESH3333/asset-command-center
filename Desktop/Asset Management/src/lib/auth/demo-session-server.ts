import { cookies } from 'next/headers';
import {
  demoSessionToProfile,
  parseDemoSessionCookie,
  DEMO_SESSION_COOKIE,
  type DemoSession,
} from './demo-session';
import type { UserProfile } from './session';

export async function getDemoSessionServer(): Promise<DemoSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(DEMO_SESSION_COOKIE)?.value;
  return parseDemoSessionCookie(raw);
}

export async function getDemoProfileServer(): Promise<UserProfile | null> {
  const session = await getDemoSessionServer();
  if (!session) return null;
  return demoSessionToProfile(session);
}
