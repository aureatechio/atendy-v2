import { NextResponse } from "next/server";
import {
  fetchAccessibleAlertById,
  getAlertAuthContext,
  snoozeAlertForUserUntil,
} from "@/lib/alerts/server";
import {
  createAuditOperationId,
  getAuditActor,
  logAuditEvent,
  type AuditJsonObject,
} from "@/lib/audit/logger";
import { getAuditRequestContext } from "@/lib/audit/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_HOURS = 24;
const MAX_HOURS = 24 * 30;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await getAlertAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let hours = DEFAULT_HOURS;
  try {
    const body = (await req.json()) as { hours?: unknown } | null;
    if (body && typeof body.hours === "number" && Number.isFinite(body.hours)) {
      hours = Math.min(Math.max(1, Math.floor(body.hours)), MAX_HOURS);
    }
  } catch {
    /* body opcional */
  }

  const snoozedUntil = new Date(Date.now() + hours * 3_600_000).toISOString();

  const alert = await fetchAccessibleAlertById(auth.context, id);
  if (!alert.ok) {
    return NextResponse.json({ error: alert.error }, { status: alert.status });
  }

  const operationId = createAuditOperationId();
  const [actor, context] = await Promise.all([
    getAuditActor(auth.context.user),
    getAuditRequestContext(),
  ]);

  const result = await snoozeAlertForUserUntil(
    auth.context,
    alert.alert,
    snoozedUntil,
    { legacySnoozeHours: hours },
  );
  if (!result.ok) {
    await logAuditEvent({
      action: "alert.snoozed",
      actor,
      before: alert.alert as unknown as AuditJsonObject,
      clienteId: alert.alert.cliente?.id ?? null,
      context,
      entityId: id,
      entityType: "sla_alert",
      errorMessage: result.error,
      metadata: { hours },
      operationId,
      status: "failure",
    });
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await logAuditEvent({
    action: "alert.snoozed",
    actor,
    before: alert.alert as unknown as AuditJsonObject,
    clienteId: alert.alert.cliente?.id ?? null,
    context,
    entityId: id,
    entityType: "sla_alert",
    metadata: { hours, snoozedUntil: result.snoozedUntil },
    operationId,
  });

  return NextResponse.json({
    ok: true,
    notificationId: result.notification.id,
    snoozedUntil: result.snoozedUntil,
  });
}
