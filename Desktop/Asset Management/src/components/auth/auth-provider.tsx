'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { UserProfile } from '@/lib/auth/session';
import type { AppRole } from '@/lib/auth/roles';
import {
  clearDemoSession,
  demoSessionToProfile,
  getDemoSession,
  saveDemoSession,
  type DemoSession,
} from '@/lib/auth/demo-session';

type DemoUser = {
  id: string;
  email: string;
};

type AuthContextValue = {
  user: DemoUser | null;
  profile: UserProfile | null;
  role: AppRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function sessionToUser(session: DemoSession): DemoUser {
  return { id: 'demo-user', email: session.email };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DemoUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadFromStorage = useCallback(() => {
    const session = getDemoSession();
    if (!session) {
      setUser(null);
      setProfile(null);
      return;
    }
    saveDemoSession(session);
    setUser(sessionToUser(session));
    setProfile(demoSessionToProfile(session));
  }, []);

  const refreshProfile = useCallback(async () => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    loadFromStorage();
    setLoading(false);

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'demo_session') loadFromStorage();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [loadFromStorage]);

  const signOut = async () => {
    clearDemoSession();
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
