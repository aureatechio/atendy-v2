import { describe, expect, it } from "vitest";
import { formatLastLogin, formatLastLoginDetails } from "@/lib/auth/last-login";

describe("last login formatting", () => {
  const now = new Date("2026-05-18T12:00:00");

  it("formats today's login with time", () => {
    expect(formatLastLogin("2026-05-18T09:30:00", now)).toBe("hoje às 09:30");
  });

  it("formats yesterday's login with time", () => {
    expect(formatLastLogin("2026-05-17T21:05:00", now)).toBe("ontem às 21:05");
  });

  it("keeps a full hover detail for valid dates", () => {
    expect(formatLastLoginDetails("2026-05-17T21:05:03")).toContain("21:05:03");
  });

  it("handles empty values", () => {
    expect(formatLastLogin(null)).toBe("Nunca");
    expect(formatLastLoginDetails(null)).toBe("Usuario ainda nao fez login.");
  });
});
