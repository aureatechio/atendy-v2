import { describe, expect, it } from "vitest";
import { toDateRange, isWithinRange } from "@/lib/period";

describe("period utilities", () => {
  it("retorna intervalo do ano", () => {
    const [from, to] = toDateRange("year", { from: "", to: "" });
    expect(from).toBeTruthy();
    expect(to).toBeTruthy();
    if (!from || !to) return;
    expect(from.getMonth()).toBe(0);
    expect(from.getDate()).toBe(1);
    expect(to.getMonth()).toBe(11);
    expect(to.getDate()).toBe(31);
  });

  it("compara dentro do range", () => {
    const range = toDateRange("month", { from: "", to: "" });
    const sample = new Date(2026, 4, 10);
    expect(isWithinRange(sample, range)).toBe(true);
  });

  it("range customizado ordena datas invertidas", () => {
    const [from, to] = toDateRange("custom", { from: "2026-05-10", to: "2026-05-05" });
    expect(from && to).toBeTruthy();
    if (!from || !to) return;
    expect(from.getTime()).toBeLessThanOrEqual(to.getTime());
  });
});
