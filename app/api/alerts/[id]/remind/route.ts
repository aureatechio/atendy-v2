import { NextResponse } from "next/server";
import {
  fetchAccessibleAlertById,
  getAlertAuthContext,
  remindAlertForUser,
} from "@/lib/alerts/server";
import {
  isReminderOption,
  type ReminderOption,
} from "@/lib/alerts/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseReminder(value: unknown): ReminderOption | null {
  if (value === "tomorrow") return value;
  const numeric =
    typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return isReminderOption(numeric) ? numeric : null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await getAlertAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let reminder: ReminderOption | null = null;
  try {
    const body = (await req.json()) as
      | { reminder?: unknown; value?: unknown; minutes?: unknown }
      | null;
    reminder = parseReminder(body?.reminder ?? body?.value ?? body?.minutes);
  } catch {
    reminder = null;
  }

  if (reminder === null) {
    return NextResponse.json(
      { error: "Invalid reminder option" },
      { status: 400 },
    );
  }

  const alert = await fetchAccessibleAlertById(auth.context, id);
  if (!alert.ok) {
    return NextResponse.json({ error: alert.error }, { status: alert.status });
  }

  const result = await remindAlertForUser(auth.context, alert.alert, reminder);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    notificationId: result.notification.id,
    snoozedUntil: result.snoozedUntil,
  });
}
