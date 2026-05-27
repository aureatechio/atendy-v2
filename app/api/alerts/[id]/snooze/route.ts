import { NextResponse } from "next/server";
import { createAuditOperationId, getAuditActor, logAuditEvent } from "@/lib/audit/logger";
import { getAuditRequestContext } from "@/lib/audit/request-context";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_HOURS = 24;
const MAX_HOURS = 24 * 30;
const alertColumns =
  "id,type,cliente_id,stage_id,task_id,status,entered_at,deadline,fired_at,last_seen_at,resolved_at,resolved_by,snoozed_until";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const { data: beforeAlert } = await supabase.from("sla_alerts").select(alertColumns).eq("id", id).maybeSingle();
  if (!beforeAlert) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  const operationId = createAuditOperationId();
  const [actor, context] = await Promise.all([getAuditActor(user), getAuditRequestContext()]);
  const { data: afterAlert, error } = await supabase
    .from("sla_alerts")
    .update({ snoozed_until: snoozedUntil })
    .eq("id", id)
    .is("resolved_at", null)
    .select(alertColumns)
    .maybeSingle();

  if (error) {
    await logAuditEvent({
      action: "alert.snoozed",
      actor,
      before: beforeAlert,
      clienteId: beforeAlert.cliente_id,
      context,
      entityId: id,
      entityType: "sla_alert",
      errorMessage: error.message,
      metadata: { hours },
      operationId,
      status: "failure",
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAuditEvent({
    action: "alert.snoozed",
    actor,
    after: afterAlert ?? { ...beforeAlert, snoozed_until: snoozedUntil },
    before: beforeAlert,
    clienteId: beforeAlert.cliente_id,
    context,
    entityId: id,
    entityType: "sla_alert",
    metadata: { hours },
    operationId,
  });

  return NextResponse.json({ ok: true, snoozedUntil });
}
