"use client";

import type { Session } from "@supabase/supabase-js";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { timeAuthStep } from "@/lib/auth/debug";
import type { Profile } from "@/lib/auth/types";
import {
  profileSelectColumns,
  summarizeAuthUser,
  type AuthSnapshot,
  type AuthUserSummary,
} from "@/lib/auth/session";

type AuthContextValue = {
  loading: boolean;
  session: Session | null;
  user: AuthUserSummary | null;
  profile: Profile | null;
  isAuthenticated: boolean;
  isPending: boolean;
  isBlocked: boolean;
  isAdmin: boolean;
  isSupervisor: boolean;
  isCsHead: boolean;
  isDev: boolean;
  isAuditAccess: boolean;
  isCsAccess: boolean;
  isSettingsAccess: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  updatePassword: (password: string) => Promise<{ error?: string }>;
  refreshProfile: () => Promise<Profile | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type LoadProfileOptions = {
  force?: boolean;
};

export function AuthProvider({ children, initialAuth }: { children: React.ReactNode; initialAuth?: AuthSnapshot }) {
  const initialUser = initialAuth?.user ?? null;
  const initialProfile = initialAuth?.profile ?? null;
  const hasActiveInitialAuth = initialAuth?.status === "active";
  const [loading, setLoading] = useState(!hasActiveInitialAuth);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUserSummary | null>(initialUser);
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const profileRef = useRef<Profile | null>(initialProfile);
  const profileRequestRef = useRef<{ userId: string; promise: Promise<Profile | null> } | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const loadProfile = useCallback(
    async (userId: string, options: LoadProfileOptions = {}) => {
      if (!options.force && profileRef.current?.id === userId) {
        return profileRef.current;
      }

      if (!options.force && profileRequestRef.current?.userId === userId) {
        return profileRequestRef.current.promise;
      }

      const promise: Promise<Profile | null> = timeAuthStep("client profile", () =>
        supabase.from("profiles").select(profileSelectColumns).eq("id", userId).maybeSingle(),
      ).then(({ data, error }) => {
        if (error || !data) {
          profileRef.current = null;
          setProfile(null);
          return null;
        }

        const nextProfile = data as Profile;
        profileRef.current = nextProfile;
        setProfile(nextProfile);
        return nextProfile;
      });

      profileRequestRef.current = { userId, promise };

      try {
        return await promise;
      } finally {
        if (profileRequestRef.current?.promise === promise) {
          profileRequestRef.current = null;
        }
      }
    },
    [supabase],
  );

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return null;
    }

    return loadProfile(user.id, { force: true });
  }, [loadProfile, user]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      if (hasActiveInitialAuth) {
        setLoading(false);
        return;
      }

      try {
        const {
          data: { session: initialSession },
        } = await timeAuthStep("client auth.getSession", () => supabase.auth.getSession());
        const initialUser = initialSession?.user ?? null;

        if (!mounted) {
          return;
        }

        setSession(initialSession);
        setUser(initialUser ? summarizeAuthUser(initialUser) : null);

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
      setUser(nextUser ? summarizeAuthUser(nextUser) : null);

      if (!nextUser) {
        profileRef.current = null;
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
  }, [hasActiveInitialAuth, loadProfile, supabase]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        return { error: "E-mail ou senha invalidos." };
      }

      setSession(data.session);
      setUser(data.user ? summarizeAuthUser(data.user) : null);

      if (data.user) {
        const nextProfile = await loadProfile(data.user.id, { force: true });

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
    profileRef.current = null;
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
    const isCsHead = profile?.role === "cs_head";
    const isDev = profile?.role === "dev";
    const isCsAccess = isAdmin || isCsHead || isDev;
    const isAuditAccess = isAdmin || isDev;
    // Configurações (etapas/SLAs/feriados): mesmo grupo do CS por enquanto.
    const isSettingsAccess = isAdmin || isCsHead || isDev;

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
      isCsHead,
      isDev,
      isAuditAccess,
      isCsAccess,
      isSettingsAccess,
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
