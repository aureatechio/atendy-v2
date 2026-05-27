import { NextResponse } from "next/server";
import { createAuditOperationId, getAuditActor, logAuditEvent } from "@/lib/audit/logger";
import { getAuditRequestContext } from "@/lib/audit/request-context";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const alertColumns =
  "id,type,cliente_id,stage_id,task_id,status,entered_at,deadline,fired_at,last_seen_at,resolved_at,resolved_by,snoozed_until";

export async function POST(
  _req: Request,
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

  const now = new Date().toISOString();
  const { data: beforeAlert } = await supabase.from("sla_alerts").select(alertColumns).eq("id", id).maybeSingle();
  if (!beforeAlert) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  const operationId = createAuditOperationId();
  const [actor, context] = await Promise.all([getAuditActor(user), getAuditRequestContext()]);
  const { data: afterAlert, error } = await supabase
    .from("sla_alerts")
    .update({ resolved_at: now, resolved_by: user.id })
    .eq("id", id)
    .is("resolved_at", null)
    .select(alertColumns)
    .maybeSingle();

  if (error) {
    await logAuditEvent({
      action: "alert.resolved",
      actor,
      before: beforeAlert,
      clienteId: beforeAlert.cliente_id,
      context,
      entityId: id,
      entityType: "sla_alert",
      errorMessage: error.message,
      operationId,
      status: "failure",
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAuditEvent({
    action: "alert.resolved",
    actor,
    after: afterAlert ?? { ...beforeAlert, resolved_at: now, resolved_by: user.id },
    before: beforeAlert,
    clienteId: beforeAlert.cliente_id,
    context,
    entityId: id,
    entityType: "sla_alert",
    operationId,
  });

  return NextResponse.json({ ok: true });
}
