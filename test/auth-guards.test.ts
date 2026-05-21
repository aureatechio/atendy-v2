import { describe, expect, it } from "vitest";
import { buildLoginRedirect, canAccessAdmin, canAccessCS, getProtectedAuthRedirect } from "@/lib/auth/guards";
import { roleHasCapability } from "@/lib/auth/capabilities";
import type { AuthSnapshot } from "@/lib/auth/session";
import type { Profile } from "@/lib/auth/types";

const profile: Profile = {
  id: "user-1",
  full_name: "Usuario Teste",
  avatar_url: null,
  role: "producao",
  status: "active",
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

  it("allows only admin, dev and cs_head into CS routes", () => {
    const make = (role: Profile["role"], id = "user-x"): AuthSnapshot => ({
      status: "active",
      user: { id, email: `${role}@test.local` },
      profile: { ...profile, id, role },
    });

    expect(canAccessCS(make("admin"))).toBe(true);
    expect(canAccessCS(make("dev"))).toBe(true);
    expect(canAccessCS(make("cs_head"))).toBe(true);
    expect(canAccessCS(make("supervisor"))).toBe(false);
    expect(canAccessCS(make("attendant"))).toBe(false);
    expect(canAccessCS(make("producao"))).toBe(false);
    expect(canAccessCS({ status: "anonymous", user: null, profile: null })).toBe(false);
  });
});

describe("capabilities", () => {
  it("admin has every capability", () => {
    expect(roleHasCapability("admin", "adminOnly")).toBe(true);
    expect(roleHasCapability("admin", "adminArea")).toBe(true);
    expect(roleHasCapability("admin", "csArea")).toBe(true);
  });

  it("supervisor has adminArea but not adminOnly nor csArea", () => {
    expect(roleHasCapability("supervisor", "adminArea")).toBe(true);
    expect(roleHasCapability("supervisor", "adminOnly")).toBe(false);
    expect(roleHasCapability("supervisor", "csArea")).toBe(false);
  });

  it("cs_head and dev belong to csArea only", () => {
    for (const role of ["cs_head", "dev"] as const) {
      expect(roleHasCapability(role, "csArea")).toBe(true);
      expect(roleHasCapability(role, "adminArea")).toBe(false);
      expect(roleHasCapability(role, "adminOnly")).toBe(false);
    }
  });

  it("attendant, producao and designer have no capabilities", () => {
    for (const role of ["attendant", "producao", "designer"] as const) {
      expect(roleHasCapability(role, "adminOnly")).toBe(false);
      expect(roleHasCapability(role, "adminArea")).toBe(false);
      expect(roleHasCapability(role, "csArea")).toBe(false);
    }
  });
});
