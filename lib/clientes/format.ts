import { parseDate, ptDateFormatter } from "@/lib/utils";

export function buildWhatsappHref(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

export function parseClienteDate(value: string | null): Date | null {
  if (!value) return null;

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  return parseDate(value);
}

export function formatNullableDate(value: string | null): string {
  if (!value) return "—";

  const parsed = parseClienteDate(value);
  return parsed ? ptDateFormatter.format(parsed) : value;
}
