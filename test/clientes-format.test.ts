import { describe, expect, it } from "vitest";
import { buildWhatsappHref, formatNullableDate, parseClienteDate } from "@/lib/clientes/format";

describe("clientes format helpers", () => {
  it("builds a WhatsApp wa.me href from formatted phone text", () => {
    expect(buildWhatsappHref("+55 (11) 99999-1234")).toBe("https://wa.me/5511999991234");
  });

  it("returns null when WhatsApp text has no digits", () => {
    expect(buildWhatsappHref("sem telefone")).toBeNull();
    expect(buildWhatsappHref(null)).toBeNull();
  });

  it("formats nullable dates and keeps invalid date text visible", () => {
    expect(formatNullableDate("2026-05-20")).toBe("20/05/2026");
    expect(formatNullableDate(null)).toBe("—");
    expect(formatNullableDate("data inválida")).toBe("data inválida");
  });

  it("parses ISO date-only values as local calendar dates", () => {
    const parsed = parseClienteDate("2026-05-20");

    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(4);
    expect(parsed?.getDate()).toBe(20);
  });
});
