'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import type { UserProfile } from '@/lib/auth/session';
import type { AppRole } from '@/lib/auth/roles';
import { isAppRole } from '@/lib/auth/roles';
import {
  clearDemoSession,
  demoSessionToProfile,
  getDemoSession,
  saveDemoSession,
  type DemoSession,
} from '@/lib/auth/demo-session';
import { syncCurrentUserAction } from '@/app/actions/users';

type AuthContextValue = {
  user: User | { id: string; email: string } | null;
  profile: UserProfile | null;
  role: AppRole | null;
  loading: boolean;
  isDemo: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const DEMO_AUTH = process.env.NEXT_PUBLIC_DEMO_AUTH === 'true';

function sessionToUser(session: DemoSession): { id: string; email: string } {
  return { id: 'demo-user', email: session.email };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | { id: string; email: string } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  const loadDemoSession = useCallback(() => {
    const session = getDemoSession();
    if (!session) return false;
    saveDemoSession(session);
    setIsDemo(true);
    setUser(sessionToUser(session));
    setProfile(demoSessionToProfile(session));
    return true;
  }, []);

  const hydrateFromSupabase = useCallback(async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      if (DEMO_AUTH && loadDemoSession()) return;
      setUser(null);
      setProfile(null);
      setIsDemo(false);
      return;
    }

    setIsDemo(false);
    setUser(session.user);

    const result = await syncCurrentUserAction();
    if (result.data) {
      const role = isAppRole(result.data.role) ? result.data.role : 'Employee';
      setProfile({ ...result.data, role });
    } else {
      setProfile(null);
    }
  }, [loadDemoSession]);

  const refreshProfile = useCallback(async () => {
    if (isDemo) {
      loadDemoSession();
      return;
    }
    await hydrateFromSupabase();
  }, [hydrateFromSupabase, isDemo, loadDemoSession]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      await hydrateFromSupabase();
      if (mounted) setLoading(false);
    })();

    if (!DEMO_AUTH) {
      const supabase = createClient();
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          setIsDemo(false);
          return;
        }
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          await hydrateFromSupabase();
        }
      });
      return () => {
        mounted = false;
        subscription.unsubscribe();
      };
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'demo_session') loadDemoSession();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      mounted = false;
      window.removeEventListener('storage', onStorage);
    };
  }, [hydrateFromSupabase, loadDemoSession]);

  const signOut = async () => {
    if (isDemo) {
      clearDemoSession();
      setUser(null);
      setProfile(null);
      window.location.href = '/login';
      return;
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role: profile?.role ?? null,
        loading,
        isDemo,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
