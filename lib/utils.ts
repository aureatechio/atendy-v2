import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const ptDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});

export function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function parsePtDateBr(value: string): Date | null {
  if (!value) return null;
  const d = value.trim();

  if (d.includes("/")) {
    const [datePart, timePart] = d.split(" ");
    const [day, month, year] = datePart.split("/").map(Number);
    const [hour, minute] = timePart ? timePart.split(":").map(Number) : [0, 0];
    const parsed = new Date(year, month - 1, day, hour || 0, minute || 0);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  return parsePtDateBr(value);
}

export function formatDate(value: string): string {
  const parsed = parsePtDateBr(value);
  if (!parsed) return value ?? "";
  return ptDateFormatter.format(parsed);
}

export function formatMonthLabel(year: number, monthIndex: number) {
  return `${String(monthIndex + 1).padStart(2, "0")}/${year}`;
}
