import { PeriodPreset, DateRange } from "@/lib/types";
import { formatDate } from "@/lib/utils";

interface DateRangeOptions {
  monthIndex?: number;
  now?: Date;
}

export function getNowDateParts(now = new Date()) {
  const today = now;
  return {
    year: today.getFullYear(),
    month: today.getMonth(),
    day: today.getDate(),
  };
}

function dayRange(date: Date): [Date, Date] {
  return [
    new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0),
    new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999),
  ];
}

export function toDateRange(
  period: PeriodPreset,
  custom: DateRange,
  options: DateRangeOptions = {},
): [Date | null, Date | null] {
  const today = options.now ?? new Date();
  const { year, month } = getNowDateParts(today);

  if (period === "today") {
    return dayRange(today);
  }

  if (period === "last7" || period === "last30") {
    const days = period === "last7" ? 7 : 30;
    const fromDate = new Date(year, month, today.getDate() - days + 1);
    const [from] = dayRange(fromDate);
    const [, to] = dayRange(today);
    return [from, to];
  }

  if (period === "month") {
    const from = new Date(year, month, 1, 0, 0, 0, 0);
    const to = new Date(year, month + 1, 0, 23, 59, 59, 999);
    return [from, to];
  }

  if (period === "monthPick") {
    const pickedMonth = Math.max(0, Math.min(options.monthIndex ?? month, month));
    const from = new Date(year, pickedMonth, 1, 0, 0, 0, 0);
    const to = new Date(year, pickedMonth + 1, 0, 23, 59, 59, 999);
    return [from, to];
  }

  if (period === "lastMonth") {
    const from = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const to = new Date(year, month, 0, 23, 59, 59, 999);
    return [from, to];
  }

  if (period === "year") {
    const from = new Date(year, 0, 1, 0, 0, 0, 0);
    const to = new Date(year, 11, 31, 23, 59, 59, 999);
    return [from, to];
  }

  if (period === "custom" && custom.from && custom.to) {
    const [yf, mf, df] = custom.from.split("-").map(Number);
    const [yt, mt, dt] = custom.to.split("-").map(Number);
    if (!Number.isNaN(yf + mf + df + yt + mt + dt)) {
      const from = new Date(yf, mf - 1, df, 0, 0, 0, 0);
      const to = new Date(yt, mt - 1, dt, 23, 59, 59, 999);
      if (from <= to) return [from, to];
      return [to, from];
    }
  }

  return [null, null];
}

export function formatPeriodLabel(period: PeriodPreset, custom: DateRange) {
  if (period === "all") return "Todo o período";
  if (period === "today") return "Hoje";
  if (period === "last7") return "Últimos 7 dias";
  if (period === "last30") return "Últimos 30 dias";
  if (period === "month") return "Mês atual";
  if (period === "lastMonth") return "Mês anterior";
  if (period === "monthPick") return "Mês selecionado";
  if (period === "year") return "Este ano";

  if (period === "custom" && custom.from && custom.to) {
    const f = new Date(`${custom.from}T00:00:00`);
    const t = new Date(`${custom.to}T00:00:00`);
    return `${formatDate(f.toISOString())} – ${formatDate(t.toISOString())}`;
  }

  return "Período customizado";
}

export function isWithinRange(date: Date | null, periodRange: [Date | null, Date | null]) {
  if (!date) return false;
  const [from, to] = periodRange;
  if (!from && !to) return true;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}
