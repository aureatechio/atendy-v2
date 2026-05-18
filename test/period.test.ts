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

  it("retorna intervalo de hoje usando data injetada", () => {
    const [from, to] = toDateRange("today", { from: "", to: "" }, { now: new Date(2026, 4, 18, 12) });
    expect(from?.toISOString()).toBe(new Date(2026, 4, 18, 0, 0, 0, 0).toISOString());
    expect(to?.toISOString()).toBe(new Date(2026, 4, 18, 23, 59, 59, 999).toISOString());
  });

  it("retorna últimos 7 e 30 dias incluindo hoje", () => {
    const now = new Date(2026, 4, 18, 12);
    const [from7, to7] = toDateRange("last7", { from: "", to: "" }, { now });
    const [from30, to30] = toDateRange("last30", { from: "", to: "" }, { now });

    expect(from7?.toISOString()).toBe(new Date(2026, 4, 12, 0, 0, 0, 0).toISOString());
    expect(to7?.toISOString()).toBe(new Date(2026, 4, 18, 23, 59, 59, 999).toISOString());
    expect(from30?.toISOString()).toBe(new Date(2026, 3, 19, 0, 0, 0, 0).toISOString());
    expect(to30?.toISOString()).toBe(new Date(2026, 4, 18, 23, 59, 59, 999).toISOString());
  });

  it("retorna mês selecionado do ano atual limitado ao mês atual", () => {
    const now = new Date(2026, 4, 18, 12);
    const [from, to] = toDateRange("monthPick", { from: "", to: "" }, { monthIndex: 2, now });
    const [futureFrom, futureTo] = toDateRange("monthPick", { from: "", to: "" }, { monthIndex: 11, now });

    expect(from?.toISOString()).toBe(new Date(2026, 2, 1, 0, 0, 0, 0).toISOString());
    expect(to?.toISOString()).toBe(new Date(2026, 2, 31, 23, 59, 59, 999).toISOString());
    expect(futureFrom?.toISOString()).toBe(new Date(2026, 4, 1, 0, 0, 0, 0).toISOString());
    expect(futureTo?.toISOString()).toBe(new Date(2026, 4, 31, 23, 59, 59, 999).toISOString());
  });
});
