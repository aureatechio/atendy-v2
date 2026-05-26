export type AlertNotificationState = "pending" | "snoozed" | "resolved";
export type AlertAction =
  | "notification_created"
  | "toast_shown"
  | "reminded"
  | "opened"
  | "resolved"
  | "auto_reopened";
export type ReminderOption = 5 | 15 | 30 | 60 | 120 | "tomorrow";

export interface AlertNotificationLike {
  state: AlertNotificationState;
  snoozed_until: string | null;
  next_toast_at: string | null;
  last_shown_at: string | null;
}

export const REMINDER_OPTIONS: readonly {
  value: ReminderOption;
  label: string;
}[] = [
  { value: 5, label: "5 min" },
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hora" },
  { value: 120, label: "2 horas" },
  { value: "tomorrow", label: "Dia seguinte" },
];

const MINUTE_OPTIONS = new Set([5, 15, 30, 60, 120]);
const SAO_PAULO_TZ = "America/Sao_Paulo";

function timestamp(value: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

export function getReminderMinutes(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  return MINUTE_OPTIONS.has(value) ? value : null;
}

export function isReminderOption(value: unknown): value is ReminderOption {
  return getReminderMinutes(value) !== null || value === "tomorrow";
}

export function computeReminderUntil(value: ReminderOption, now = new Date()) {
  const minutes = getReminderMinutes(value);
  if (minutes !== null) {
    return new Date(now.getTime() + minutes * 60_000);
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SAO_PAULO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  return new Date(Date.UTC(year, month - 1, day + 1, 12, 0, 0, 0));
}

export function isNotificationVisible(
  notification: AlertNotificationLike,
  now = new Date(),
) {
  if (notification.state === "resolved") return false;
  const snoozedUntil = timestamp(notification.snoozed_until);
  if (notification.state === "snoozed" && snoozedUntil !== null) {
    return snoozedUntil <= now.getTime();
  }
  return true;
}

export function shouldToastNotification(
  notification: AlertNotificationLike,
  now = new Date(),
) {
  if (!isNotificationVisible(notification, now)) return false;
  const nextToastAt = timestamp(notification.next_toast_at);
  return nextToastAt === null || nextToastAt <= now.getTime();
}
