import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from './supabase';
import type { Profile, UserRole } from './types';
import { initNetworkListener, syncOfflineQueue, dbGetQueueCount, fullSync } from './offline';
import { initDb } from './db';

interface AuthContextValue {
  profile: Profile | null;
  session: import('@supabase/supabase-js').Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  pendingSyncCount: number;
  triggerSync: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<AuthContextValue['session']>(null);
  const [loading, setLoading] = useState(true);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error loading profile:', error);
      return;
    }
    setProfile(data as Profile | null);
  }, []);

  const refreshPendingCount = useCallback(async () => {
    const count = await dbGetQueueCount();
    setPendingSyncCount(count);
  }, []);

  const triggerSync = useCallback(async () => {
    const result = await syncOfflineQueue();
    await refreshPendingCount();
    if (result.synced > 0) {
      console.log(`Synced ${result.synced} maintenances`);
    }
  }, [refreshPendingCount]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    (async () => {
      await initDb();

      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      setSession(currentSession);

      if (currentSession?.user) {
        await loadProfile(currentSession.user.id);
        await refreshPendingCount();
        const result = await syncOfflineQueue();
        if (result.synced > 0) await refreshPendingCount();
      }

      const profileRole = profile?.role || 'technician';
      const profileId = profile?.id || '';
      unsubscribe = initNetworkListener(profileRole, profileId);

      refreshPendingCount();

      setLoading(false);
    })();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      (async () => {
        setSession(newSession);
        if (event === 'SIGNED_OUT' || !newSession) {
          setProfile(null);
          return;
        }
        if (newSession.user) {
          await loadProfile(newSession.user.id);
          await refreshPendingCount();
          await syncOfflineQueue().then(refreshPendingCount);
          if (profile) {
            await fullSync(profile.role, profile.id);
          }
        }
      })();
    });

    return () => {
      authListener.subscription.unsubscribe();
      if (unsubscribe) unsubscribe();
    };
  }, [loadProfile, refreshPendingCount]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    if (data.user) {
      await loadProfile(data.user.id);
      const loadedProfile = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();
      if (loadedProfile.data) {
        const p = loadedProfile.data as Profile;
        await refreshPendingCount();
        await syncOfflineQueue();
        await fullSync(p.role, p.id);
        await refreshPendingCount();
      }
    }
    return { error: null };
  }, [loadProfile, refreshPendingCount]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user) {
      await loadProfile(session.user.id);
    }
  }, [session, loadProfile]);

  return (
    <AuthContext.Provider
      value={{ profile, session, loading, signIn, signOut, refreshProfile, pendingSyncCount, triggerSync }}
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
