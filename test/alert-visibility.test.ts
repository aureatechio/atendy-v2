import { describe, expect, it } from "vitest";
import { canAccessAlertForCliente } from "@/lib/alerts/visibility";
import type { UserRole } from "@/lib/auth/types";

const userId = "00000000-0000-0000-0000-000000000001";
const otherUserId = "00000000-0000-0000-0000-000000000002";

function profile(role: UserRole, id = userId) {
  return { id, role };
}

describe("canAccessAlertForCliente", () => {
  it.each(["admin", "dev", "supervisor", "cs_head"] as const)(
    "allows %s to see assigned alerts regardless of responsible user",
    (role) => {
      expect(
        canAccessAlertForCliente(profile(role), {
          responsavel_atendimento: otherUserId,
          assigned_to: null,
        }),
      ).toBe(true);
    },
  );

  it.each(["attendant", "producao", "designer"] as const)(
    "allows operational %s only when responsavel_atendimento matches",
    (role) => {
      expect(
        canAccessAlertForCliente(profile(role), {
          responsavel_atendimento: userId,
          assigned_to: otherUserId,
        }),
      ).toBe(true);
      expect(
        canAccessAlertForCliente(profile(role), {
          responsavel_atendimento: otherUserId,
          assigned_to: null,
        }),
      ).toBe(false);
    },
  );

  it.each(["attendant", "producao", "designer"] as const)(
    "allows operational %s when assigned_to matches",
    (role) => {
      expect(
        canAccessAlertForCliente(profile(role), {
          responsavel_atendimento: otherUserId,
          assigned_to: userId,
        }),
      ).toBe(true);
    },
  );

  it.each(["admin", "supervisor"] as const)(
    "allows %s to see unassigned client alerts",
    (role) => {
      expect(
        canAccessAlertForCliente(profile(role), {
          responsavel_atendimento: null,
          assigned_to: null,
        }),
      ).toBe(true);
    },
  );

  it.each(["dev", "cs_head", "attendant", "producao", "designer"] as const)(
    "blocks %s from unassigned client alerts",
    (role) => {
      expect(
        canAccessAlertForCliente(profile(role), {
          responsavel_atendimento: null,
          assigned_to: null,
        }),
      ).toBe(false);
    },
  );
});
