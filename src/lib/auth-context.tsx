import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { api } from "./api";
import type { AppUser } from "../types";

interface AuthContextValue {
  session: Session | null;
  appUser: AppUser | null;
  /** True while the initial session restore (or the /auth/me fetch after a fresh sign-in) is in flight. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// How long any single auth step is allowed to leave the UI stuck waiting
// before giving up on it -- a hung request (bad network, a stalled
// third-party call) should degrade to a visible error/login screen, never
// an indefinite blank "Loading..." with no way out.
const AUTH_TIMEOUT_MS = 15000;

function timeoutRejection(message: string): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), AUTH_TIMEOUT_MS));
}

/**
 * Best-effort GPS fix, sent up alongside the IP-based location /auth/me
 * already records. Entirely non-blocking: if the browser doesn't support
 * geolocation, the user denies the permission prompt, or it times out, this
 * silently does nothing and the IP-based location (already shown) stands.
 * IP geolocation alone can be wildly wrong for anyone behind a VPN or
 * Cloudflare WARP -- GPS is unaffected by that.
 */
function reportBrowserLocation() {
  if (!("geolocation" in navigator)) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      api.auth.updateLocation(pos.coords.latitude, pos.coords.longitude).catch(() => {});
    },
    () => {
      // Permission denied, unavailable, or timed out -- nothing to do.
    },
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 },
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [userLoading, setUserLoading] = useState(false);

  useEffect(() => {
    let active = true;
    // The real restore -- always attached, so a merely-slow (not actually
    // hung) response still lands correctly whenever it finally comes back,
    // independent of the timeout fallback below.
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setSessionLoading(false);
    });
    // A hung restore (bad network, a stalled request) shouldn't leave the
    // whole app on a blank loading screen forever -- give up on waiting
    // after AUTH_TIMEOUT_MS and fall through to whatever session state we
    // have (none yet), which lands on the login page instead of a stuck
    // spinner. Only flips the loading flag -- never touches `session`
    // itself, so the real restore above can still complete correctly later.
    const timeout = setTimeout(() => {
      if (active) setSessionLoading(false);
    }, AUTH_TIMEOUT_MS);
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => {
      active = false;
      clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) {
      setAppUser(null);
      return;
    }
    // Keyed on the user id, not the session object -- Supabase emits a new
    // session object (same user) on every token refresh, and re-running
    // this on each of those would otherwise cascade: refetch /auth/me ->
    // that request itself reads the session -> more state churn -> more
    // refreshes. Only the signed-in *user* changing should trigger a refetch.
    let active = true;
    setUserLoading(true);
    const timeout = setTimeout(() => {
      // Same reasoning as the session-restore timeout above -- a hung
      // /auth/me call degrades to AppShell's existing "couldn't load your
      // account" screen instead of an indefinite spinner.
      if (active) setUserLoading(false);
    }, AUTH_TIMEOUT_MS);
    api.auth
      .me()
      .then((u) => {
        if (active) setAppUser(u);
        reportBrowserLocation();
      })
      .catch(() => {
        if (active) setAppUser(null);
      })
      .finally(() => {
        clearTimeout(timeout);
        if (active) setUserLoading(false);
      });
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [userId]);

  async function signIn(email: string, password: string) {
    const { error } = await Promise.race([
      supabase.auth.signInWithPassword({ email, password }),
      timeoutRejection("Sign-in is taking too long -- check your connection and try again."),
    ]);
    if (error) throw error;
  }

  async function signInWithGoogle() {
    // Full-page redirect flow -- Supabase handles the callback and restores
    // the session automatically (detectSessionInUrl, on by default), so
    // there's nothing to await here besides surfacing a config error, e.g.
    // if the Google provider isn't enabled in the Supabase dashboard yet.
    // Timeout-raced the same way as signIn -- this call itself is just
    // kicking off the redirect, not the OAuth round-trip, but it still
    // makes its own network request first and can hang the same way.
    const { error } = await Promise.race([
      supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      }),
      timeoutRejection("Google sign-in is taking too long -- check your connection and try again."),
    ]);
    if (error) throw error;
  }

  async function signOut() {
    await supabase.auth.signOut();
    setAppUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        appUser,
        loading: sessionLoading || (Boolean(session) && userLoading),
        signIn,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export function canManage(role: AppUser["role"] | undefined): boolean {
  return role === "admin" || role === "manager";
}
