const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});

const weekdayFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
});

const shortDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
});

const fullDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const detailedDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameYear(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear();
}

function parseLoginDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatLastLogin(value: string | null, now = new Date()) {
  const date = parseLoginDate(value);

  if (!date) return "Nunca";

  const diffInDays = Math.round((startOfDay(now).getTime() - startOfDay(date).getTime()) / 86_400_000);
  const time = timeFormatter.format(date);

  if (diffInDays === 0) return `hoje às ${time}`;
  if (diffInDays === 1) return `ontem às ${time}`;
  if (diffInDays > 1 && diffInDays < 7) return `${weekdayFormatter.format(date)} às ${time}`;
  if (isSameYear(date, now)) return `${shortDateFormatter.format(date)} às ${time}`;

  return `${fullDateFormatter.format(date)} às ${time}`;
}

export function formatLastLoginDetails(value: string | null) {
  const date = parseLoginDate(value);
  return date ? detailedDateFormatter.format(date) : "Usuario ainda nao fez login.";
}
