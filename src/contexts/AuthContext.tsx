import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';

export interface ProfilePrefs {
  useCase?: 'dating' | 'friends' | 'work' | 'family' | 'anxiety';
  tone?: 'nice' | 'real' | 'savage';
  spiralModeDefault?: boolean;
}

export interface Profile {
  id: string;
  onboarding_completed: boolean;
  prefs: ProfilePrefs;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  profileLoading: boolean;
  signInWithMagicLink: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refetchProfile: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, onboarding_completed, prefs')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return {
    id: data.id,
    onboarding_completed: data.onboarding_completed ?? false,
    prefs: (data.prefs as ProfilePrefs) ?? {},
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const refetchProfile = useCallback(async () => {
    if (!user?.id) return;
    setProfileLoading(true);
    try {
      const p = await fetchProfile(user.id);
      setProfile(p);
    } finally {
      setProfileLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    setProfileLoading(true);
    fetchProfile(user.id).then((p) => {
      if (!cancelled) setProfile(p);
    }).finally(() => {
      if (!cancelled) setProfileLoading(false);
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  const signInWithMagicLink = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/app` },
    });
    return { error: error ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const refreshSession = useCallback(async () => {
    const { data: { session: newSession } } = await supabase.auth.refreshSession();
    setSession(newSession);
    setUser(newSession?.user ?? null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      loading,
      profileLoading,
      signInWithMagicLink,
      signOut,
      refetchProfile,
      refreshSession,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
