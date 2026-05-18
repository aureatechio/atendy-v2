import { describe, expect, it } from "vitest";
import { buildLoginRedirect, canAccessAdmin, getProtectedAuthRedirect } from "@/lib/auth/guards";
import type { AuthSnapshot } from "@/lib/auth/session";
import type { Profile } from "@/lib/auth/types";

const profile: Profile = {
  id: "user-1",
  full_name: "Usuario Teste",
  avatar_url: null,
  role: "producao",
  status: "active",
  specialty: null,
  permissions: null,
  is_team_admin: false,
  autorizado_tirar_analise_ia: false,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("auth guards", () => {
  it("builds safe login redirects for protected paths", () => {
    expect(buildLoginRedirect("/funil?tab=kanban")).toBe("/login?redirectTo=%2Ffunil%3Ftab%3Dkanban");
    expect(buildLoginRedirect("//evil.test")).toBe("/login?redirectTo=%2F");
  });

  it("maps protected auth snapshots to redirects", () => {
    expect(getProtectedAuthRedirect({ status: "anonymous", user: null, profile: null }, "/funil")).toBe(
      "/login?redirectTo=%2Ffunil",
    );

    expect(
      getProtectedAuthRedirect({
        status: "blocked",
        user: { id: "user-1", email: "user@test.local" },
        profile: { ...profile, status: "blocked" },
      }),
    ).toBe("/login?error=blocked");

    expect(
      getProtectedAuthRedirect({
        status: "active",
        user: { id: "user-1", email: "user@test.local" },
        profile,
      }),
    ).toBeNull();
  });

  it("allows only active admin and supervisor snapshots into admin routes", () => {
    const activeAdmin: AuthSnapshot = {
      status: "active",
      user: { id: "user-1", email: "admin@test.local" },
      profile: { ...profile, role: "admin" },
    };
    const activeSupervisor: AuthSnapshot = {
      status: "active",
      user: { id: "user-2", email: "supervisor@test.local" },
      profile: { ...profile, id: "user-2", role: "supervisor" },
    };
    const activeProducao: AuthSnapshot = {
      status: "active",
      user: { id: "user-3", email: "producao@test.local" },
      profile: { ...profile, id: "user-3", role: "producao" },
    };

    expect(canAccessAdmin(activeAdmin)).toBe(true);
    expect(canAccessAdmin(activeSupervisor)).toBe(true);
    expect(canAccessAdmin(activeProducao)).toBe(false);
    expect(canAccessAdmin({ status: "anonymous", user: null, profile: null })).toBe(false);
  });
});
