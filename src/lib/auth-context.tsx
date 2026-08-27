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
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setSessionLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => {
      active = false;
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
        if (active) setUserLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signInWithGoogle() {
    // Full-page redirect flow -- Supabase handles the callback and restores
    // the session automatically (detectSessionInUrl, on by default), so
    // there's nothing to await here besides surfacing a config error, e.g.
    // if the Google provider isn't enabled in the Supabase dashboard yet.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
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
