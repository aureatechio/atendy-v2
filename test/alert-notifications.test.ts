import { describe, expect, it } from "vitest";
import {
  computeReminderUntil,
  getReminderMinutes,
  isNotificationVisible,
  shouldToastNotification,
  type AlertNotificationLike,
} from "@/lib/alerts/notifications";

const now = new Date("2026-05-26T15:00:00.000Z");

function notification(
  overrides: Partial<AlertNotificationLike> = {},
): AlertNotificationLike {
  return {
    state: "pending",
    snoozed_until: null,
    next_toast_at: null,
    last_shown_at: null,
    ...overrides,
  };
}

describe("alert notification state", () => {
  it("hides future snoozed notifications", () => {
    expect(
      isNotificationVisible(
        notification({
          state: "snoozed",
          snoozed_until: "2026-05-26T15:05:00.000Z",
        }),
        now,
      ),
    ).toBe(false);
  });

  it("shows snoozed notifications once the reminder is due", () => {
    expect(
      isNotificationVisible(
        notification({
          state: "snoozed",
          snoozed_until: "2026-05-26T14:59:59.000Z",
        }),
        now,
      ),
    ).toBe(true);
  });

  it("does not show resolved notifications", () => {
    expect(isNotificationVisible(notification({ state: "resolved" }), now)).toBe(
      false,
    );
  });

  it("toasts pending notifications with no next toast date", () => {
    expect(shouldToastNotification(notification(), now)).toBe(true);
  });

  it("toasts pending notifications when next toast is due", () => {
    expect(
      shouldToastNotification(
        notification({ next_toast_at: "2026-05-26T15:00:00.000Z" }),
        now,
      ),
    ).toBe(true);
  });

  it("does not toast pending notifications before next toast date", () => {
    expect(
      shouldToastNotification(
        notification({ next_toast_at: "2026-05-26T15:01:00.000Z" }),
        now,
      ),
    ).toBe(false);
  });
});

describe("alert reminder options", () => {
  it.each([
    [5, "2026-05-26T15:05:00.000Z"],
    [15, "2026-05-26T15:15:00.000Z"],
    [30, "2026-05-26T15:30:00.000Z"],
    [60, "2026-05-26T16:00:00.000Z"],
    [120, "2026-05-26T17:00:00.000Z"],
  ] as const)("computes %s minute reminders", (value, expected) => {
    expect(computeReminderUntil(value, now).toISOString()).toBe(expected);
  });

  it("computes tomorrow reminder for the next local morning", () => {
    expect(computeReminderUntil("tomorrow", now).toISOString()).toBe(
      "2026-05-27T12:00:00.000Z",
    );
  });

  it("rejects unsupported reminder values", () => {
    expect(getReminderMinutes(45)).toBeNull();
    expect(getReminderMinutes("tomorrow")).toBeNull();
    expect(getReminderMinutes(120)).toBe(120);
  });
});
