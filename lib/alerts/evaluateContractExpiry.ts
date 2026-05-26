import type { CurrentAlert } from "@/lib/sla/diffAlerts";

const BR_TIMEZONE = "America/Sao_Paulo";
const DAY_MS = 86_400_000;

const BR_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: BR_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export interface ContractExpiryClienteRow {
  id: string;
  vigencia: string | null;
  inicio_vigencia: string | null;
  data_contrato_assinado: string | null;
}

export interface EvaluateContractExpiryInput {
  clientes: ContractExpiryClienteRow[];
  warningDays?: number;
  now?: Date;
}

interface ParsedBrDate {
  iso: string;
  start: Date;
  end: Date;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function isValidDateParts(year: number, month: number, day: number) {
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

function buildBrDate(year: number, month: number, day: number): ParsedBrDate | null {
  if (!isValidDateParts(year, month, day)) return null;
  const iso = `${year}-${pad2(month)}-${pad2(day)}`;
  return {
    iso,
    start: new Date(`${iso}T00:00:00-03:00`),
    end: new Date(`${iso}T23:59:59.999-03:00`),
  };
}

function brIsoDateOf(date: Date) {
  const parts = BR_DATE_FORMATTER.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  return `${map.year}-${map.month}-${map.day}`;
}

function parseBrDate(value: string | null): ParsedBrDate | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const isoDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoDateMatch) {
    return buildBrDate(
      Number(isoDateMatch[1]),
      Number(isoDateMatch[2]),
      Number(isoDateMatch[3]),
    );
  }

  const brDateMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (brDateMatch) {
    return buildBrDate(
      Number(brDateMatch[3]),
      Number(brDateMatch[2]),
      Number(brDateMatch[1]),
    );
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  const [year, month, day] = brIsoDateOf(date).split("-").map(Number);
  return buildBrDate(year, month, day);
}

function dateOrdinal(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function evaluateContractExpiry({
  clientes,
  warningDays = 15,
  now = new Date(),
}: EvaluateContractExpiryInput): CurrentAlert[] {
  const out: CurrentAlert[] = [];
  const todayIso = brIsoDateOf(now);
  const todayOrdinal = dateOrdinal(todayIso);

  for (const cliente of clientes) {
    const expiry = parseBrDate(cliente.vigencia);
    if (!expiry) continue;

    const daysUntilExpiry = Math.round(
      (dateOrdinal(expiry.iso) - todayOrdinal) / DAY_MS,
    );

    let status: "warning" | "overdue" | null = null;
    if (daysUntilExpiry < 0) status = "overdue";
    else if (daysUntilExpiry <= warningDays) status = "warning";
    if (!status) continue;

    const entered =
      parseBrDate(cliente.inicio_vigencia) ??
      parseBrDate(cliente.data_contrato_assinado);

    out.push({
      type: "contract_expiry",
      clienteId: cliente.id,
      stageId: null,
      taskId: null,
      status,
      enteredAt: (entered?.start ?? expiry.end).toISOString(),
      deadline: expiry.end.toISOString(),
    });
  }

  return out;
}
