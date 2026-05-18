import type { SlaUnit } from "@/lib/types";

const BR_TIMEZONE = "America/Sao_Paulo";

const ISO_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: BR_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

interface BrParts {
  iso: string;
  dow: number;
  hour: number;
  minute: number;
  second: number;
}

function toBrParts(date: Date): BrParts {
  const parts = ISO_DATE_FORMATTER.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  const iso = `${map.year}-${map.month}-${map.day}`;
  return {
    iso,
    dow: WEEKDAY_INDEX[map.weekday] ?? 0,
    hour: Number(map.hour ?? "0"),
    minute: Number(map.minute ?? "0"),
    second: Number(map.second ?? "0"),
  };
}

function isoBrDateOf(date: Date): string {
  return toBrParts(date).iso;
}

function isNonBusinessDay(date: Date, holidays: ReadonlySet<string>): boolean {
  const { dow, iso } = toBrParts(date);
  return dow === 0 || dow === 6 || holidays.has(iso);
}

function buildBrMidnight(isoDate: string): Date {
  // Constrói uma Date que representa 00:00 BRT do isoDate.
  // BRT é UTC-3 fixo (sem DST desde 2019). Usamos offset fixo pra evitar bugs de Intl.
  return new Date(`${isoDate}T00:00:00-03:00`);
}

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCDate(base.getUTCDate() + days);
  const y = base.getUTCFullYear();
  const m = String(base.getUTCMonth() + 1).padStart(2, "0");
  const d = String(base.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface CalculateDeadlineInput {
  enteredAt: Date | string | null;
  slaAmount: number | null;
  slaUnit: SlaUnit;
  holidays?: Iterable<string>;
}

export function calculateSlaDeadline({
  enteredAt,
  slaAmount,
  slaUnit,
  holidays = [],
}: CalculateDeadlineInput): Date | null {
  if (slaAmount === null || slaAmount === undefined || enteredAt === null || enteredAt === undefined) {
    return null;
  }

  const entered = enteredAt instanceof Date ? enteredAt : new Date(enteredAt);
  if (Number.isNaN(entered.getTime())) return null;

  if (slaUnit === "calendar_hours") {
    return new Date(entered.getTime() + slaAmount * 3_600_000);
  }

  if (slaUnit === "business_hours") {
    throw new Error("sla_unit business_hours ainda nao suportado");
  }

  const holidaySet: ReadonlySet<string> = holidays instanceof Set ? holidays : new Set(holidays);

  let current = entered;
  while (isNonBusinessDay(current, holidaySet)) {
    const isoDate = isoBrDateOf(current);
    current = buildBrMidnight(addDays(isoDate, 1));
  }

  let remaining = slaAmount;
  while (remaining > 0) {
    current = new Date(current.getTime() + 86_400_000);
    if (!isNonBusinessDay(current, holidaySet)) {
      remaining -= 1;
    }
  }

  return current;
}

export interface SlaStatusInput {
  enteredAt: Date | string | null;
  slaAmount: number | null;
  slaUnit: SlaUnit;
  warnAtPercent: number;
  holidays?: Iterable<string>;
  now?: Date;
}

export type SlaStatus = "ok" | "warning" | "overdue" | "none";

export interface SlaEvaluation {
  status: SlaStatus;
  deadline: Date | null;
  hoursRemaining: number | null;
}

export function evaluateSla(input: SlaStatusInput): SlaEvaluation {
  const deadline = calculateSlaDeadline({
    enteredAt: input.enteredAt,
    slaAmount: input.slaAmount,
    slaUnit: input.slaUnit,
    holidays: input.holidays,
  });
  if (!deadline || !input.enteredAt) {
    return { status: "none", deadline: null, hoursRemaining: null };
  }
  const now = input.now ?? new Date();
  const entered = input.enteredAt instanceof Date ? input.enteredAt : new Date(input.enteredAt);
  const hoursRemaining = (deadline.getTime() - now.getTime()) / 3_600_000;
  if (hoursRemaining < 0) {
    return { status: "overdue", deadline, hoursRemaining };
  }
  const totalMs = deadline.getTime() - entered.getTime();
  const elapsedMs = now.getTime() - entered.getTime();
  const elapsedPercent = totalMs > 0 ? (elapsedMs / totalMs) * 100 : 0;
  if (elapsedPercent >= input.warnAtPercent) {
    return { status: "warning", deadline, hoursRemaining };
  }
  return { status: "ok", deadline, hoursRemaining };
}
