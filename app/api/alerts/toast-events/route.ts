import { NextResponse } from "next/server";
import {
  fetchAccessibleAlertById,
  getAlertAuthContext,
  logVisibleAlertEvents,
  type AlertRecordRow,
} from "@/lib/alerts/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ToastEventAction = "toast_shown" | "opened";

function parseAlertIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === "string"))].slice(
    0,
    50,
  );
}

function parseEvent(value: unknown): ToastEventAction | null {
  return value === "toast_shown" || value === "opened" ? value : null;
}

export async function POST(req: Request) {
  const auth = await getAlertAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let event: ToastEventAction | null = null;
  let alertIds: string[] = [];
  try {
    const body = (await req.json()) as
      | { event?: unknown; alertIds?: unknown }
      | null;
    event = parseEvent(body?.event);
    alertIds = parseAlertIds(body?.alertIds);
  } catch {
    event = null;
    alertIds = [];
  }

  if (!event || alertIds.length === 0) {
    return NextResponse.json({ error: "Invalid toast event" }, { status: 400 });
  }

  const alerts: AlertRecordRow[] = [];
  for (const alertId of alertIds) {
    const result = await fetchAccessibleAlertById(auth.context, alertId);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }
    alerts.push(result.alert);
  }

  const result = await logVisibleAlertEvents(auth.context, alerts, event);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
