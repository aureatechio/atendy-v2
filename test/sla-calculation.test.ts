import { describe, expect, it } from "vitest";
import { calculateSlaDeadline, evaluateSla } from "@/lib/sla/calculateDeadline";

// BRT é UTC-3 fixo. Para legibilidade usamos sufixo "-03:00" nas datas.
const HOLIDAYS_2026 = new Set([
  "2026-04-21", // Tiradentes
  "2026-05-01", // Dia do Trabalho
  "2026-06-04", // Corpus Christi
]);

function brt(iso: string): string {
  return `${iso}-03:00`;
}

function brtIso(date: Date): string {
  // Formata em BRT pra asserts legíveis.
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace(" ", "T");
}

describe("calculateSlaDeadline (business_days)", () => {
  it("retorna NULL quando sla_amount é NULL", () => {
    expect(
      calculateSlaDeadline({
        enteredAt: brt("2026-05-18T14:00:00"),
        slaAmount: null,
        slaUnit: "business_days",
      }),
    ).toBeNull();
  });

  it("retorna NULL quando enteredAt é NULL", () => {
    expect(
      calculateSlaDeadline({ enteredAt: null, slaAmount: 1, slaUnit: "business_days" }),
    ).toBeNull();
  });

  it("seg 14:00 + 1 dia útil = ter 14:00", () => {
    const result = calculateSlaDeadline({
      enteredAt: brt("2026-05-18T14:00:00"),
      slaAmount: 1,
      slaUnit: "business_days",
    });
    expect(brtIso(result!)).toBe("2026-05-19T14:00:00");
  });

  it("sex 23:00 + 1 dia útil = seg 23:00 (pula sáb/dom)", () => {
    const result = calculateSlaDeadline({
      enteredAt: brt("2026-05-22T23:00:00"),
      slaAmount: 1,
      slaUnit: "business_days",
    });
    expect(brtIso(result!)).toBe("2026-05-25T23:00:00");
  });

  it("sáb 10:00 + 1 dia útil = ter 00:00 (estrito: pula pra seg 00:00, soma 1 útil)", () => {
    const result = calculateSlaDeadline({
      enteredAt: brt("2026-05-23T10:00:00"),
      slaAmount: 1,
      slaUnit: "business_days",
    });
    expect(brtIso(result!)).toBe("2026-05-26T00:00:00");
  });

  it("dom 14:00 + 1 dia útil = ter 00:00", () => {
    const result = calculateSlaDeadline({
      enteredAt: brt("2026-05-24T14:00:00"),
      slaAmount: 1,
      slaUnit: "business_days",
    });
    expect(brtIso(result!)).toBe("2026-05-26T00:00:00");
  });

  it("qui 30-abr 14:00 + 1 dia útil (sex 1-mai feriado) = seg 4-mai 14:00", () => {
    const result = calculateSlaDeadline({
      enteredAt: brt("2026-04-30T14:00:00"),
      slaAmount: 1,
      slaUnit: "business_days",
      holidays: HOLIDAYS_2026,
    });
    expect(brtIso(result!)).toBe("2026-05-04T14:00:00");
  });

  it("qua 3-jun 10:00 + 1 dia útil (qui 4-jun Corpus Christi) = sex 5-jun 10:00", () => {
    const result = calculateSlaDeadline({
      enteredAt: brt("2026-06-03T10:00:00"),
      slaAmount: 1,
      slaUnit: "business_days",
      holidays: HOLIDAYS_2026,
    });
    expect(brtIso(result!)).toBe("2026-06-05T10:00:00");
  });

  it("seg 18-mai 14:00 + 2 dias úteis = qua 20-mai 14:00", () => {
    const result = calculateSlaDeadline({
      enteredAt: brt("2026-05-18T14:00:00"),
      slaAmount: 2,
      slaUnit: "business_days",
    });
    expect(brtIso(result!)).toBe("2026-05-20T14:00:00");
  });
});

describe("calculateSlaDeadline (calendar_hours)", () => {
  it("seg 14:00 + 24h = ter 14:00 (não pula fim de semana)", () => {
    const result = calculateSlaDeadline({
      enteredAt: brt("2026-05-18T14:00:00"),
      slaAmount: 24,
      slaUnit: "calendar_hours",
    });
    expect(brtIso(result!)).toBe("2026-05-19T14:00:00");
  });

  it("sex 14:00 + 24h = sáb 14:00 (calendar não respeita dia útil)", () => {
    const result = calculateSlaDeadline({
      enteredAt: brt("2026-05-22T14:00:00"),
      slaAmount: 24,
      slaUnit: "calendar_hours",
    });
    expect(brtIso(result!)).toBe("2026-05-23T14:00:00");
  });
});

describe("calculateSlaDeadline (business_hours)", () => {
  it("lança erro — ainda não suportado", () => {
    expect(() =>
      calculateSlaDeadline({
        enteredAt: brt("2026-05-18T14:00:00"),
        slaAmount: 8,
        slaUnit: "business_hours",
      }),
    ).toThrow();
  });
});

describe("evaluateSla", () => {
  it("retorna none quando sem SLA", () => {
    const result = evaluateSla({
      enteredAt: brt("2026-05-18T14:00:00"),
      slaAmount: null,
      slaUnit: "business_days",
      warnAtPercent: 80,
      now: new Date(brt("2026-05-19T10:00:00")),
    });
    expect(result.status).toBe("none");
    expect(result.deadline).toBeNull();
  });

  it("retorna ok quando dentro do prazo e abaixo do limiar de alerta", () => {
    const result = evaluateSla({
      enteredAt: brt("2026-05-18T14:00:00"),
      slaAmount: 1,
      slaUnit: "business_days",
      warnAtPercent: 80,
      // 4h depois de seg 14:00, deadline ter 14:00 (24h total) → 4/24 = 16%
      now: new Date(brt("2026-05-18T18:00:00")),
    });
    expect(result.status).toBe("ok");
  });

  it("retorna warning quando acima do limiar mas ainda dentro do prazo", () => {
    const result = evaluateSla({
      enteredAt: brt("2026-05-18T14:00:00"),
      slaAmount: 1,
      slaUnit: "business_days",
      warnAtPercent: 80,
      // 22h depois → 22/24 = ~91% > 80%, ainda <100%
      now: new Date(brt("2026-05-19T12:00:00")),
    });
    expect(result.status).toBe("warning");
  });

  it("retorna overdue quando passou do deadline", () => {
    const result = evaluateSla({
      enteredAt: brt("2026-05-18T14:00:00"),
      slaAmount: 1,
      slaUnit: "business_days",
      warnAtPercent: 80,
      now: new Date(brt("2026-05-19T16:00:00")),
    });
    expect(result.status).toBe("overdue");
    expect(result.hoursRemaining! < 0).toBe(true);
  });
});
