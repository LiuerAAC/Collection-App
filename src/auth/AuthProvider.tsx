import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";
import { fetchAuthUser, loadStoredSession, persistSession, refreshAuthSession, signInWithPassword, signOutFromSupabase, signUpWithPassword } from "./supabaseAuth";
import { AuthSession, AuthUser } from "../types";
import { hasSupabaseRuntimeConfig } from "../config";

type AuthContextValue = {
  enabled: boolean;
  ready: boolean;
  busy: boolean;
  user: AuthUser | null;
  session: AuthSession | null;
  error?: string;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const REFRESH_BUFFER_MS = 60_000;
const TRANSIENT_SESSION_ERROR_PATTERNS = [
  "failed to fetch",
  "network",
  "load failed",
  "timed out",
  "timeout"
];

function isRecoverableSessionError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return TRANSIENT_SESSION_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

export function AuthProvider({ children }: PropsWithChildren) {
  const enabled = hasSupabaseRuntimeConfig();
  const [ready, setReady] = useState(!enabled);
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    const bootstrap = async () => {
      const stored = loadStoredSession();
      if (!stored) {
        if (!cancelled) {
          setReady(true);
        }
        return;
      }

      try {
        const activeSession = stored.expiresAt - Date.now() < REFRESH_BUFFER_MS
          ? await refreshAuthSession(stored.refreshToken)
          : stored;
        const activeUser = activeSession.user.id ? activeSession.user : await fetchAuthUser(activeSession.accessToken);
        if (cancelled) {
          return;
        }
        const nextSession = { ...activeSession, user: activeUser };
        persistSession(nextSession);
        setSession(nextSession);
        setUser(activeUser);
      } catch (bootstrapError) {
        if (cancelled) {
          return;
        }
        if (isRecoverableSessionError(bootstrapError)) {
          setSession(stored);
          setUser(stored.user);
          setError("Offline session kept on this device. We will retry cloud auth when the network is back.");
        } else {
          persistSession(null);
          setSession(null);
          setUser(null);
          setError(bootstrapError instanceof Error ? bootstrapError.message : "Failed to restore session.");
        }
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !session) {
      return;
    }

    const refreshIn = Math.max(5_000, session.expiresAt - Date.now() - REFRESH_BUFFER_MS);
    const timer = window.setTimeout(() => {
      refreshAuthSession(session.refreshToken)
        .then((nextSession) => {
          const mergedSession = { ...nextSession, user: nextSession.user.id ? nextSession.user : session.user };
          persistSession(mergedSession);
          setSession(mergedSession);
          setUser(mergedSession.user);
          setError(undefined);
        })
        .catch((refreshError) => {
          if (isRecoverableSessionError(refreshError)) {
            setError("This device will keep you signed in and retry session refresh automatically.");
            return;
          }
          persistSession(null);
          setSession(null);
          setUser(null);
          setError(refreshError instanceof Error ? refreshError.message : "Session refresh failed.");
        });
    }, refreshIn);

    return () => window.clearTimeout(timer);
  }, [enabled, session]);

  const value = useMemo<AuthContextValue>(() => ({
    enabled,
    ready,
    busy,
    user,
    session,
    error,
    signIn: async (email, password) => {
      setBusy(true);
      setError(undefined);
      try {
        const nextSession = await signInWithPassword(email, password);
        persistSession(nextSession);
        setSession(nextSession);
        setUser(nextSession.user);
      } finally {
        setBusy(false);
      }
    },
    signUp: async (email, password) => {
      setBusy(true);
      setError(undefined);
      try {
        const nextSession = await signUpWithPassword(email, password);
        persistSession(nextSession);
        setSession(nextSession);
        setUser(nextSession.user);
      } finally {
        setBusy(false);
      }
    },
    signOut: async () => {
      setBusy(true);
      setError(undefined);
      try {
        if (session) {
          await signOutFromSupabase(session.accessToken);
        }
      } finally {
        persistSession(null);
        setSession(null);
        setUser(null);
        setBusy(false);
      }
    }
  }), [busy, enabled, error, ready, session, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
