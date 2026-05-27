import { NextResponse } from "next/server";
import {
  fetchAccessibleAlertById,
  getAlertAuthContext,
  resolveAlertForUser,
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

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await getAlertAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const alert = await fetchAccessibleAlertById(auth.context, id);
  if (!alert.ok) {
    return NextResponse.json({ error: alert.error }, { status: alert.status });
  }

  const operationId = createAuditOperationId();
  const [actor, context] = await Promise.all([
    getAuditActor(auth.context.user),
    getAuditRequestContext(),
  ]);

  const result = await resolveAlertForUser(auth.context, alert.alert);
  if (!result.ok) {
    await logAuditEvent({
      action: "alert.resolved",
      actor,
      before: alert.alert as unknown as AuditJsonObject,
      clienteId: alert.alert.cliente?.id ?? null,
      context,
      entityId: id,
      entityType: "sla_alert",
      errorMessage: result.error,
      operationId,
      status: "failure",
    });
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await logAuditEvent({
    action: "alert.resolved",
    actor,
    before: alert.alert as unknown as AuditJsonObject,
    clienteId: alert.alert.cliente?.id ?? null,
    context,
    entityId: id,
    entityType: "sla_alert",
    operationId,
  });

  return NextResponse.json({ ok: true });
}
