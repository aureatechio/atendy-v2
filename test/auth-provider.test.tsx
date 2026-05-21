import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import type { AuthSnapshot } from "@/lib/auth/session";
import type { Profile } from "@/lib/auth/types";

type AuthStateCallback = (event: string, session: { user: { id: string; email?: string | null } } | null) => void;

let supabaseMock: ReturnType<typeof createSupabaseMock>;

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => supabaseMock,
}));

const profile: Profile = {
  id: "user-1",
  full_name: "Usuario Teste",
  avatar_url: null,
  role: "producao",
  status: "active",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const activeSnapshot: AuthSnapshot = {
  status: "active",
  user: { id: "user-1", email: "user@test.local" },
  profile,
};

function createSupabaseMock() {
  const maybeSingle = vi.fn().mockResolvedValue({ data: profile, error: null });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  let authStateCallback: AuthStateCallback | null = null;

  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn((callback: AuthStateCallback) => {
        authStateCallback = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      signInWithPassword: vi.fn(),
      signOut: vi.fn().mockResolvedValue({}),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
      updateUser: vi.fn().mockResolvedValue({ error: null }),
    },
    emitAuthState(session: { user: { id: string; email?: string | null } } | null) {
      authStateCallback?.("SIGNED_IN", session);
    },
    from,
    maybeSingle,
  };
}

function Probe() {
  const auth = useAuth();

  return (
    <div>
      <span data-testid="loading">{auth.loading ? "loading" : "ready"}</span>
      <span data-testid="email">{auth.user?.email ?? "no-email"}</span>
      <span data-testid="profile">{auth.profile?.full_name ?? "no-profile"}</span>
      <span data-testid="authenticated">{auth.isAuthenticated ? "authenticated" : "anonymous"}</span>
      <button type="button" onClick={() => void auth.refreshProfile()}>
        Refresh profile
      </button>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    supabaseMock = createSupabaseMock();
  });

  it("starts ready from an active server snapshot without fetching the profile again", async () => {
    render(
      <AuthProvider initialAuth={activeSnapshot}>
        <Probe />
      </AuthProvider>,
    );

    expect(screen.getByTestId("loading")).toHaveTextContent("ready");
    expect(screen.getByTestId("email")).toHaveTextContent("user@test.local");
    expect(screen.getByTestId("profile")).toHaveTextContent("Usuario Teste");
    expect(screen.getByTestId("authenticated")).toHaveTextContent("authenticated");
    await waitFor(() => expect(supabaseMock.auth.onAuthStateChange).toHaveBeenCalledTimes(1));
    expect(supabaseMock.auth.getSession).not.toHaveBeenCalled();
    expect(supabaseMock.maybeSingle).not.toHaveBeenCalled();
  });

  it("does not refetch profile when Supabase emits the same user after an active snapshot", async () => {
    render(
      <AuthProvider initialAuth={activeSnapshot}>
        <Probe />
      </AuthProvider>,
    );

    act(() => {
      supabaseMock.emitAuthState({ user: { id: "user-1", email: "user@test.local" } });
    });

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("ready"));
    expect(supabaseMock.maybeSingle).not.toHaveBeenCalled();
  });

  it("forces a profile query when refreshProfile is called", async () => {
    render(
      <AuthProvider initialAuth={activeSnapshot}>
        <Probe />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Refresh profile" }));

    await waitFor(() => expect(supabaseMock.maybeSingle).toHaveBeenCalledTimes(1));
  });
});
