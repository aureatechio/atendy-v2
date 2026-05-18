import { PeriodPreset, DateRange } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export function getNowDateParts() {
  const today = new Date();
  return {
    year: today.getFullYear(),
    month: today.getMonth(),
    day: today.getDate(),
  };
}

export function toDateRange(period: PeriodPreset, custom: DateRange): [Date | null, Date | null] {
  const today = new Date();
  const { year, month } = getNowDateParts();

  if (period === "month") {
    const from = new Date(year, month, 1, 0, 0, 0, 0);
    const to = new Date(year, month + 1, 0, 23, 59, 59, 999);
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
  if (period === "month") return "Mês atual";
  if (period === "lastMonth") return "Mês anterior";
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
