import { AuthSession, AuthUser } from "../types";
import { supabaseRuntimeConfig } from "../config";

const AUTH_STORAGE_KEY = "collection-auth-session";

type SupabaseAuthPayload = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: {
    id: string;
    email?: string;
  };
};

function ensureSupabaseAuthConfig() {
  if (!supabaseRuntimeConfig.url || !supabaseRuntimeConfig.anonKey) {
    throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.");
  }
}

function authHeaders(extra: Record<string, string> = {}) {
  ensureSupabaseAuthConfig();
  return {
    apikey: supabaseRuntimeConfig.anonKey,
    "Content-Type": "application/json",
    ...extra
  };
}

function toSession(payload: SupabaseAuthPayload): AuthSession {
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: Date.now() + payload.expires_in * 1000,
    user: {
      id: payload.user.id,
      email: payload.user.email
    }
  };
}

async function readJson<T>(response: Response) {
  const text = await response.text();
  if (!text) {
    return {} as T;
  }
  return JSON.parse(text) as T;
}

export function loadStoredSession() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function persistSession(session: AuthSession | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!session) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export async function signUpWithPassword(email: string, password: string) {
  ensureSupabaseAuthConfig();
  const response = await fetch(`${supabaseRuntimeConfig.url}/auth/v1/signup`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email, password })
  });

  const payload = await readJson<Partial<SupabaseAuthPayload> & { msg?: string; error_description?: string }>(response);
  if (!response.ok) {
    throw new Error(payload.msg || payload.error_description || "Sign up failed.");
  }

  if (!payload.access_token || !payload.refresh_token || !payload.user) {
    throw new Error("Account created. Check your email confirmation settings before signing in.");
  }

  return toSession(payload as SupabaseAuthPayload);
}

export async function signInWithPassword(email: string, password: string) {
  ensureSupabaseAuthConfig();
  const response = await fetch(`${supabaseRuntimeConfig.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email, password })
  });
  const payload = await readJson<Partial<SupabaseAuthPayload> & { msg?: string; error_description?: string }>(response);
  if (!response.ok) {
    throw new Error(payload.msg || payload.error_description || "Sign in failed.");
  }
  return toSession(payload as SupabaseAuthPayload);
}

export async function refreshAuthSession(refreshToken: string) {
  ensureSupabaseAuthConfig();
  const response = await fetch(`${supabaseRuntimeConfig.url}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ refresh_token: refreshToken })
  });
  const payload = await readJson<Partial<SupabaseAuthPayload> & { msg?: string; error_description?: string }>(response);
  if (!response.ok) {
    throw new Error(payload.msg || payload.error_description || "Session refresh failed.");
  }
  return toSession(payload as SupabaseAuthPayload);
}

export async function fetchAuthUser(accessToken: string) {
  ensureSupabaseAuthConfig();
  const response = await fetch(`${supabaseRuntimeConfig.url}/auth/v1/user`, {
    headers: authHeaders({
      Authorization: `Bearer ${accessToken}`
    })
  });
  const payload = await readJson<AuthUser & { message?: string }>(response);
  if (!response.ok) {
    throw new Error(payload.message || "Failed to load user.");
  }
  return {
    id: payload.id,
    email: payload.email
  } satisfies AuthUser;
}

export async function signOutFromSupabase(accessToken: string) {
  ensureSupabaseAuthConfig();
  await fetch(`${supabaseRuntimeConfig.url}/auth/v1/logout`, {
    method: "POST",
    headers: authHeaders({
      Authorization: `Bearer ${accessToken}`
    })
  }).catch(() => undefined);
}
