import { NextResponse } from "next/server";
import {
  createAuditOperationId,
  getAuditActor,
  logAuditEvent,
  logAuditEvents,
  type AuditEventInput,
  type AuditJsonObject,
} from "@/lib/audit/logger";
import { getAuditRequestContext } from "@/lib/audit/request-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminAccess } from "@/lib/auth/requireAdmin";
import { updateStageSchema } from "@/lib/sla/validation";
import { COMPLETED_TASK_STATUS } from "@/lib/production-tasks/status";

const stageColumns =
  "id, name, slug, color, order_index, is_final, is_active, parent_stage_id, sla_amount, sla_unit, warn_at_percent, followup_days, created_at, updated_at";

const slaFields = ["sla_amount", "sla_unit", "warn_at_percent", "followup_days"] as const;

function pickSlaSnapshot(stage: AuditJsonObject | null) {
  if (!stage) return null;
  return {
    followup_days: stage.followup_days ?? null,
    sla_amount: stage.sla_amount ?? null,
    sla_unit: stage.sla_unit ?? null,
    warn_at_percent: stage.warn_at_percent ?? null,
  };
}

function hasSlaChange(before: AuditJsonObject | null, after: AuditJsonObject | null) {
  return slaFields.some((field) => before?.[field] !== after?.[field]);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireAdminAccess({ capability: "settingsArea" });
  if (access.error) return access.error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID obrigatorio." }, { status: 400 });
  }

  const parsed = updateStageSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados invalidos." }, { status: 400 });
  }

  const admin = createAdminClient();
  const operationId = createAuditOperationId();
  const [actor, context] = await Promise.all([getAuditActor(access.user), getAuditRequestContext()]);
  const { data: beforeStage } = await admin.from("client_pipeline_stages").select(stageColumns).eq("id", id).maybeSingle();
  const { data, error } = await admin
    .from("client_pipeline_stages")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(stageColumns)
    .single();

  if (error || !data) {
    await logAuditEvent({
      action: "settings.stage_updated",
      actor,
      before: (beforeStage as AuditJsonObject | null) ?? null,
      context,
      entityId: id,
      entityType: "client_pipeline_stage",
      errorMessage: error?.message ?? "Nao foi possivel atualizar a etapa.",
      metadata: { changes: Object.keys(parsed.data) },
      operationId,
      status: "failure",
    });
    return NextResponse.json({ error: error?.message ?? "Nao foi possivel atualizar a etapa." }, { status: 400 });
  }

  const before = (beforeStage as AuditJsonObject | null) ?? null;
  const after = data as AuditJsonObject;
  const events: AuditEventInput[] = [
    {
      action: "settings.stage_updated",
      actor,
      after,
      before,
      context,
      entityId: id,
      entityType: "client_pipeline_stage",
      metadata: { changes: Object.keys(parsed.data) },
      operationId,
    },
  ];

  if (hasSlaChange(before, after)) {
    events.push({
      action: "settings.stage_sla_changed",
      actor,
      after: pickSlaSnapshot(after),
      before: pickSlaSnapshot(before),
      context,
      entityId: id,
      entityType: "client_pipeline_stage",
      operationId,
    });
  }

  if (before?.is_active === false && after.is_active === true) {
    events.push({
      action: "settings.stage_reactivated",
      actor,
      after: { is_active: true },
      before: { is_active: false },
      context,
      entityId: id,
      entityType: "client_pipeline_stage",
      operationId,
    });
  }

  await logAuditEvents(events);

  return NextResponse.json({ stage: data });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireAdminAccess({ capability: "settingsArea" });
  if (access.error) return access.error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID obrigatorio." }, { status: 400 });
  }

  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "true";

  const admin = createAdminClient();
  const operationId = createAuditOperationId();
  const [actor, context] = await Promise.all([getAuditActor(access.user), getAuditRequestContext()]);
  const { data: beforeStage } = await admin.from("client_pipeline_stages").select(stageColumns).eq("id", id).maybeSingle();

  if (!force) {
    // Bloqueia desativação se houver clientes, tasks ou subetapas ativas
    const [clientesRes, tasksRes, substagesRes] = await Promise.all([
      admin
        .from("clientes_cadastro")
        .select("id", { count: "exact", head: true })
        .eq("current_stage_id", id)
        .neq("is_archived", true),
      admin
        .from("production_tasks")
        .select("id", { count: "exact", head: true })
        .eq("pipeline_stage_id", id)
        .neq("status", COMPLETED_TASK_STATUS),
      admin
        .from("client_pipeline_stages")
        .select("id", { count: "exact", head: true })
        .eq("parent_stage_id", id)
        .eq("is_active", true),
    ]);

    const clientesCount = clientesRes.count ?? 0;
    const tasksCount = tasksRes.count ?? 0;
    const substagesCount = substagesRes.count ?? 0;

    if (clientesCount > 0 || tasksCount > 0 || substagesCount > 0) {
      return NextResponse.json(
        {
          error:
            "Etapa em uso. Migre clientes/tasks ou desative subetapas antes de prosseguir.",
          impact: {
            clientes_count: clientesCount,
            tasks_count: tasksCount,
            substages_count: substagesCount,
          },
        },
        { status: 409 },
      );
    }
  }

  const { data, error } = await admin
    .from("client_pipeline_stages")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(stageColumns)
    .single();

  if (error || !data) {
    await logAuditEvent({
      action: "settings.stage_deactivated",
      actor,
      before: (beforeStage as AuditJsonObject | null) ?? null,
      context,
      entityId: id,
      entityType: "client_pipeline_stage",
      errorMessage: error?.message ?? "Nao foi possivel desativar a etapa.",
      operationId,
      status: "failure",
    });
    return NextResponse.json({ error: error?.message ?? "Nao foi possivel desativar a etapa." }, { status: 400 });
  }

  await logAuditEvent({
    action: "settings.stage_deactivated",
    actor,
    after: data as AuditJsonObject,
    before: (beforeStage as AuditJsonObject | null) ?? null,
    context,
    entityId: id,
    entityType: "client_pipeline_stage",
    metadata: { force },
    operationId,
  });

  return NextResponse.json({ stage: data });
}
