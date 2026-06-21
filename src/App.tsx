import { FormEvent, useState } from "react";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { BottomTabs } from "./components/BottomTabs";
import { Button } from "./components/ui";
import { AnalyticsScreen } from "./screens/AnalyticsScreen";
import { GalleryScreen } from "./screens/GalleryScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { WarehouseScreen } from "./screens/WarehouseScreen";
import { CollectionProvider, useCollection } from "./store/collectionStore";
import { AppTab } from "./types";

export function App() {
  return (
    <AuthProvider>
      <AppEntry />
    </AuthProvider>
  );
}

function AppEntry() {
  const { enabled, ready, user } = useAuth();

  if (!enabled || !ready || !user) {
    return <AuthScreen />;
  }

  return <AuthedApp />;
}

function AuthScreen() {
  const { enabled, ready, busy, user, error, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"sign_in" | "sign_up">("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | undefined>(undefined);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLocalError(undefined);
    try {
      if (mode === "sign_up") {
        await signUp(email.trim(), password);
      } else {
        await signIn(email.trim(), password);
      }
      setPassword("");
    } catch (submitError) {
      setLocalError(submitError instanceof Error ? submitError.message : "Authentication failed.");
    }
  };

  if (!enabled) {
    return (
      <div className="auth-page-shell">
        <section className="auth-hero">
          <div className="auth-hero-badge">CA</div>
          <div className="auth-hero-copy">
            <span className="eyebrow">Collection App</span>
            <h1>Cloud auth is not configured yet</h1>
            <p>Right now this local site has not loaded `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, so sign in is temporarily unavailable.</p>
          </div>
        </section>
        <section className="auth-card auth-card-narrow">
          <div className="auth-card-head">
            <strong>Finish local setup</strong>
            <span className="muted">Add the Supabase env vars in local `.env.local` and in the deployed site environment settings, then refresh the page.</span>
          </div>
        </section>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="auth-page-shell">
        <section className="auth-hero">
          <div className="auth-hero-badge">CA</div>
          <div className="auth-hero-copy">
            <span className="eyebrow">Collection App</span>
            <h1>Checking your account</h1>
            <p>We are restoring your session and preparing your collection.</p>
          </div>
        </section>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div className="auth-page-shell">
      <section className="auth-hero">
        <div className="auth-hero-badge">CA</div>
        <div className="auth-hero-copy">
          <span className="eyebrow">Collection App</span>
          <h1>Sign in to open your collection home</h1>
          <p>Your cards, photos, sync state, and backup data stay scoped to your own account.</p>
        </div>
      </section>
      <section className="auth-card">
        <div className="auth-card-head">
          <strong>Welcome back</strong>
          <span className="muted">Use your email account to continue.</span>
        </div>
        <div className="auth-mode-row">
          <button className={`auth-mode ${mode === "sign_in" ? "active" : ""}`.trim()} onClick={() => setMode("sign_in")} type="button">Sign in</button>
          <button className={`auth-mode ${mode === "sign_up" ? "active" : ""}`.trim()} onClick={() => setMode("sign_up")} type="button">Create account</button>
        </div>
        <form className="auth-form auth-form-page" onSubmit={submit}>
          <label className="field">
            <span>Email</span>
            <input onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" value={email} />
          </label>
          <label className="field">
            <span>Password</span>
            <input minLength={6} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" type="password" value={password} />
          </label>
          {localError || error ? <div className="sync-error">{localError || error}</div> : null}
          <Button className="auth-submit-button" label={busy ? "Working..." : mode === "sign_up" ? "Create account" : "Sign in"} type="submit" />
        </form>
      </section>
    </div>
  );
}

function AuthMenu() {
  const { busy, user, signOut } = useAuth();
  const { storageStatus, pushToCloud, pullFromCloud } = useCollection();
  const [open, setOpen] = useState(false);

  if (!user) {
    return null;
  }

  const progressTotal = storageStatus.photoSyncTotal ?? 0;
  const progressCompleted = storageStatus.photoSyncCompleted ?? 0;
  const progressPercent = progressTotal > 0 ? Math.round((progressCompleted / progressTotal) * 100) : 0;
  const progressLabel = storageStatus.photoSyncPhase === "uploading"
    ? `Uploading photos ${progressCompleted}/${progressTotal}`
    : storageStatus.photoSyncPhase === "prefetching"
      ? `Caching photos ${progressCompleted}/${progressTotal}`
      : storageStatus.syncInFlight
        ? storageStatus.syncAction === "pull" ? "Pulling cloud data" : "Pushing cloud data"
        : storageStatus.pendingSyncCount > 0
          ? `${storageStatus.pendingSyncCount} local change waiting`
          : "Cloud is up to date";

  return (
    <div className="auth-slot">
      <button className={`sync-icon-button ${storageStatus.syncInFlight || storageStatus.photoSyncPhase ? "active" : ""}`.trim()} onClick={() => setOpen((current) => !current)} title="Cloud sync" type="button">
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M7.5 18.5h9.2a4.3 4.3 0 0 0 .4-8.6 6.2 6.2 0 0 0-11.8 1.9A3.4 3.4 0 0 0 7.5 18.5Z" />
        </svg>
      </button>
      <button className="auth-chip avatar-only" onClick={() => setOpen((current) => !current)} title={user.email || "Signed in"} type="button">
        <span className="auth-avatar">{(user.email || "U").slice(0, 1).toUpperCase()}</span>
      </button>
      {open ? (
        <div className="auth-popover">
          <div className="auth-popover-copy">
            <strong>{user.email}</strong>
            <span className="muted">{progressLabel}</span>
          </div>
          {progressTotal > 0 ? (
            <div className="sync-progress">
              <div className="sync-progress-bar" style={{ width: `${progressPercent}%` }} />
            </div>
          ) : null}
          {storageStatus.lastSyncedAt ? <span className="muted">Last cloud sync: {new Date(storageStatus.lastSyncedAt).toLocaleString()}</span> : null}
          {storageStatus.lastError ? <div className="sync-error compact">{storageStatus.lastError}</div> : null}
          <div className="auth-popover-actions">
            <Button className="compact-button auth-action" label="Push" onClick={() => void pushToCloud()} tone="quiet" />
            <Button className="compact-button auth-action" label="Pull" onClick={() => void pullFromCloud()} tone="quiet" />
          </div>
          <Button className="compact-button auth-action" label={busy ? "Signing out..." : "Sign out"} onClick={() => void signOut()} tone="quiet" />
        </div>
      ) : null}
    </div>
  );
}

function AuthedApp() {
  const [activeTab, setActiveTab] = useState<AppTab>("warehouse");

  return (
    <CollectionProvider>
      <div className="app-shell">
        <header className="top-rail">
          <button className="app-badge" aria-label="Collection App" title="Collection App" type="button">
            <span className="brand-mark compact">CA</span>
          </button>
          <div className="top-rail-nav">
            <BottomTabs activeTab={activeTab} onChange={setActiveTab} />
          </div>
          <div className="top-rail-actions">
            <AuthMenu />
          </div>
        </header>

        <main className="main-panel">
          {activeTab === "warehouse" && <WarehouseScreen />}
          {activeTab === "gallery" && <GalleryScreen />}
          {activeTab === "analytics" && <AnalyticsScreen />}
          {activeTab === "settings" && <SettingsScreen />}
        </main>
      </div>
    </CollectionProvider>
  );
}
