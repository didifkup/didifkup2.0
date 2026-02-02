import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';

/** Profile row from public.profiles (subscription status etc.). */
export interface Profile {
  id: string;
  email: string | null;
  stripe_customer_id: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isLoading: boolean; // alias for loading, for backward compatibility
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfile(userId: string): Promise<Profile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, stripe_customer_id, subscription_status, current_period_end')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.warn('[AuthContext] profile fetch failed:', error.message);
      return null;
    }
    if (!data) return null;

    return {
      id: data.id,
      email: data.email ?? null,
      stripe_customer_id: data.stripe_customer_id ?? null,
      subscription_status: data.subscription_status ?? null,
      current_period_end: data.current_period_end != null ? String(data.current_period_end) : null,
    };
  } catch (err) {
    console.warn('[AuthContext] profile fetch error:', err);
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    if (!user?.id) {
      setProfile(null);
      return;
    }
    const p = await fetchProfile(user.id);
    setProfile(p);
  }, [user?.id]);

  useEffect(() => {
    // Initial session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    // Subscribe so UI reacts when auth changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session ?? null);
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // When user exists, fetch public.profiles row; on failure keep app rendering with free status
  useEffect(() => {
    if (!user?.id) {
      setProfile(null);
      return;
    }
    fetchProfile(user.id).then(setProfile);
  }, [user?.id]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const value: AuthContextValue = {
    user,
    session,
    profile,
    loading: isLoading,
    isLoading,
    refreshProfile,
    signIn,
    signUp,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
