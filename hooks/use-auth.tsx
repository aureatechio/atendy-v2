"use client";

import type { Session, User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/auth/types";

type AuthContextValue = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isAuthenticated: boolean;
  isPending: boolean;
  isBlocked: boolean;
  isAdmin: boolean;
  isSupervisor: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  updatePassword: (password: string) => Promise<{ error?: string }>;
  refreshProfile: () => Promise<Profile | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const profileColumns =
  "id, full_name, avatar_url, role, status, specialty, permissions, is_team_admin, autorizado_tirar_analise_ia, created_at, updated_at";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const loadProfile = useCallback(
    async (userId: string) => {
      const { data, error } = await supabase.from("profiles").select(profileColumns).eq("id", userId).maybeSingle();

      if (error || !data) {
        setProfile(null);
        return null;
      }

      const nextProfile = data as Profile;
      setProfile(nextProfile);
      return nextProfile;
    },
    [supabase],
  );

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return null;
    }

    return loadProfile(user.id);
  }, [loadProfile, user]);

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession();
        const initialUser = initialSession?.user ?? null;

        if (!mounted) {
          return;
        }

        setSession(initialSession);
        setUser(initialUser);

        if (initialUser) {
          await loadProfile(initialUser.id);
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error(error);
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setProfile(null);
      }

      if (mounted) {
        setLoading(false);
      }
    }

    void initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      const nextUser = nextSession?.user ?? null;
      setSession(nextSession);
      setUser(nextUser);

      if (!nextUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      void loadProfile(nextUser.id).finally(() => setLoading(false));
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile, supabase]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        return { error: "E-mail ou senha invalidos." };
      }

      setSession(data.session);
      setUser(data.user);

      if (data.user) {
        const nextProfile = await loadProfile(data.user.id);

        if (!nextProfile) {
          return { error: "Perfil interno nao encontrado para este usuario." };
        }

        if (nextProfile.status === "blocked") {
          await supabase.auth.signOut();
          return { error: "Conta bloqueada. Fale com um administrador." };
        }

        if (nextProfile.status !== "active") {
          return { error: "Conta pendente de aprovacao." };
        }
      }

      return {};
    },
    [loadProfile, supabase],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  }, [supabase]);

  const resetPassword = useCallback(
    async (email: string) => {
      const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

      if (error) {
        console.error(error);
      }

      return {};
    },
    [supabase],
  );

  const updatePassword = useCallback(
    async (password: string) => {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        return { error: "Nao foi possivel atualizar a senha. Solicite um novo link." };
      }

      return {};
    },
    [supabase],
  );

  const value = useMemo<AuthContextValue>(() => {
    const isAuthenticated = !!user && profile?.status === "active";
    const isPending = !!user && profile?.status === "pending";
    const isBlocked = !!user && profile?.status === "blocked";
    const isAdmin = profile?.role === "admin";
    const isSupervisor = profile?.role === "supervisor" || isAdmin;

    return {
      loading,
      session,
      user,
      profile,
      isAuthenticated,
      isPending,
      isBlocked,
      isAdmin,
      isSupervisor,
      signIn,
      signOut,
      resetPassword,
      updatePassword,
      refreshProfile,
    };
  }, [loading, profile, refreshProfile, session, signIn, signOut, resetPassword, updatePassword, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}
