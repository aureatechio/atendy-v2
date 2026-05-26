import { parseDate, ptDateFormatter } from "@/lib/utils";

export function buildWhatsappHref(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

export function formatPhone(value: string | null): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";

  const withoutCountry = digits.startsWith("55") && digits.length > 10 ? digits.slice(2) : digits;

  if (withoutCountry.length === 11) {
    return `+55 (${withoutCountry.slice(0, 2)}) ${withoutCountry.slice(2, 7)}-${withoutCountry.slice(7)}`;
  }

  if (withoutCountry.length === 10) {
    return `+55 (${withoutCountry.slice(0, 2)}) ${withoutCountry.slice(2, 6)}-${withoutCountry.slice(6)}`;
  }

  return `+55 ${digits}`;
}

export function formatCnpj(value: string | null): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 14) return value.trim();

  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
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
