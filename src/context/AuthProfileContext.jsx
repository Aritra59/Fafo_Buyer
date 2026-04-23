import { createContext, useContext, useEffect, useMemo } from "react";
import { useAuth } from "../hooks/useAuth";
import { useUserProfile } from "../hooks/useUserProfile";
import { ensureBuyerProfileOnSignIn, isProfileComplete } from "../services/userService";

const AuthProfileContext = createContext(null);

export function AuthProfileProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, error: profileError } =
    useUserProfile(user);

  useEffect(() => {
    if (!user?.uid) return undefined;
    let cancelled = false;
    (async () => {
      try {
        await ensureBuyerProfileOnSignIn(user);
      } catch (e) {
        if (!cancelled) {
          console.warn("ensureBuyerProfileOnSignIn:", e);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.uid, user]);

  const value = useMemo(() => {
    const loading = authLoading || (!!user && profileLoading);
    const profileComplete = isProfileComplete(profile);
    return {
      user,
      profile,
      loading,
      authLoading,
      profileLoading: !!user && profileLoading,
      profileComplete,
      profileError,
    };
  }, [
    user,
    profile,
    authLoading,
    profileLoading,
    profileError,
  ]);

  return (
    <AuthProfileContext.Provider value={value}>
      {children}
    </AuthProfileContext.Provider>
  );
}

export function useAuthProfile() {
  const ctx = useContext(AuthProfileContext);
  if (!ctx) {
    throw new Error("useAuthProfile must be used within AuthProfileProvider");
  }
  return ctx;
}
