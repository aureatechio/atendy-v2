import { NextResponse } from "next/server";
import { buildClientStageHistoryRow, buildTaskHistoryRow } from "@/lib/audit/history";
import {
  createAuditOperationId,
  getAuditActor,
  logAuditEvent,
  logAuditEvents,
  type AuditEventInput,
} from "@/lib/audit/logger";
import { getAuditRequestContext } from "@/lib/audit/request-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminAccess } from "@/lib/auth/requireAdmin";
import { migrateStageSchema } from "@/lib/sla/validation";
import { COMPLETED_TASK_STATUS } from "@/lib/production-tasks/status";

type ClienteMigrationRow = {
  id: string;
  current_stage_id: string | null;
};

type TaskMigrationRow = {
  cliente_id: string | null;
  id: string;
  pipeline_stage_id: string | null;
  title: string | null;
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireAdminAccess({ capability: "settingsArea" });
  if (access.error) return access.error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
  }

  const parsed = migrateStageSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }

  const { target_stage_id, reason } = parsed.data;
  if (target_stage_id === id) {
    return NextResponse.json(
      { error: "Etapa de destino deve ser diferente da etapa atual." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const userId = access.user.id;
  const operationId = createAuditOperationId();
  const [actor, context] = await Promise.all([getAuditActor(access.user), getAuditRequestContext()]);

  async function logFailure(message: string, metadata: Record<string, unknown> = {}) {
    await logAuditEvent({
      action: "settings.stage_migration_run",
      actor,
      context,
      entityId: id,
      entityType: "client_pipeline_stage",
      errorMessage: message,
      metadata: {
        origin_stage_id: id,
        target_stage_id,
        ...metadata,
      },
      operationId,
      status: "failure",
    });
  }

  // Valida etapas de origem e destino
  const [originRes, targetRes] = await Promise.all([
    admin
      .from("client_pipeline_stages")
      .select("id, name, is_active")
      .eq("id", id)
      .maybeSingle(),
    admin
      .from("client_pipeline_stages")
      .select("id, name, is_active")
      .eq("id", target_stage_id)
      .maybeSingle(),
  ]);

  if (originRes.error || !originRes.data) {
    await logFailure("Etapa de origem não encontrada.", { stage: "validate_origin" });
    return NextResponse.json({ error: "Etapa de origem não encontrada." }, { status: 404 });
  }
  if (targetRes.error || !targetRes.data) {
    await logFailure("Etapa de destino não encontrada.", { stage: "validate_target" });
    return NextResponse.json({ error: "Etapa de destino não encontrada." }, { status: 404 });
  }
  if (!targetRes.data.is_active) {
    return NextResponse.json(
      { error: "Etapa de destino está inativa. Reative-a antes." },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const migrationReason =
    reason && reason.length > 0
      ? reason
      : `Migração automática: etapa "${originRes.data.name}" → "${targetRes.data.name}".`;

  // Busca clientes na etapa de origem
  const { data: clientes, error: clientesError } = await admin
    .from("clientes_cadastro")
    .select("id,current_stage_id")
    .eq("current_stage_id", id)
    .neq("is_archived", true);

  if (clientesError) {
    await logFailure(clientesError.message, { stage: "list_clientes" });
    return NextResponse.json(
      { error: `Falha ao listar clientes: ${clientesError.message}` },
      { status: 500 },
    );
  }

  let clientesMigrated = 0;
  if (clientes && clientes.length > 0) {
    const clienteRows = clientes as ClienteMigrationRow[];
    const clienteIds = clienteRows.map((c) => c.id);

    const { error: clientesUpdateError } = await admin
      .from("clientes_cadastro")
      .update({
        current_stage_id: target_stage_id,
        stage_entered_at: now,
        updated_at: now,
      })
      .in("id", clienteIds);

    if (clientesUpdateError) {
      await logFailure(clientesUpdateError.message, { stage: "update_clientes", clientes_count: clienteIds.length });
      return NextResponse.json(
        { error: `Falha ao migrar clientes: ${clientesUpdateError.message}` },
        { status: 500 },
      );
    }

    // Registra histórico (best-effort)
    const historyRows = clienteRows.map((cliente) =>
      buildClientStageHistoryRow({
        actionType: "stage_change",
        changedBy: userId,
        clienteId: cliente.id,
        fromStageId: cliente.current_stage_id,
        metadata: { migration: true, origin_stage_id: id },
        operationId,
        reason: migrationReason,
        toStageId: target_stage_id,
      }),
    );

    const { error: historyError } = await admin
      .from("client_stage_history")
      .insert(historyRows);
    if (historyError) {
      // Não rollback — clientes já foram movidos. Apenas relata.
      console.error("Falha ao registrar client_stage_history na migração:", historyError);
    }
    clientesMigrated = clienteIds.length;
  }

  // Tasks de produção não concluídas
  const { data: tasks, error: tasksError } = await admin
    .from("production_tasks")
    .select("id,cliente_id,pipeline_stage_id,title")
    .eq("pipeline_stage_id", id)
    .neq("status", COMPLETED_TASK_STATUS);

  if (tasksError) {
    await logFailure(tasksError.message, { stage: "list_tasks" });
    return NextResponse.json(
      { error: `Falha ao listar tasks: ${tasksError.message}` },
      { status: 500 },
    );
  }

  let tasksMigrated = 0;
  if (tasks && tasks.length > 0) {
    const taskRows = tasks as TaskMigrationRow[];
    const taskIds = taskRows.map((t) => t.id);

    const { error: tasksUpdateError } = await admin
      .from("production_tasks")
      .update({
        pipeline_stage_id: target_stage_id,
        updated_at: now,
      })
      .in("id", taskIds);

    if (tasksUpdateError) {
      await logFailure(tasksUpdateError.message, { stage: "update_tasks", tasks_count: taskIds.length });
      return NextResponse.json(
        { error: `Falha ao migrar tasks: ${tasksUpdateError.message}` },
        { status: 500 },
      );
    }

    const taskHistoryRows = taskRows.map((task) =>
      buildTaskHistoryRow({
        actionType: "stage_change",
        changedBy: userId,
        clienteId: task.cliente_id,
        fromStageId: task.pipeline_stage_id,
        metadata: { migration: true, origin_stage_id: id, reason: migrationReason },
        operationId,
        taskId: task.id,
        toStageId: target_stage_id,
      }),
    );

    const { error: taskHistoryError } = await admin
      .from("task_history")
      .insert(taskHistoryRows);
    if (taskHistoryError) {
      console.error("Falha ao registrar task_history na migração:", taskHistoryError);
    }
    tasksMigrated = taskIds.length;
  }

  const clienteRows = ((clientes ?? []) as ClienteMigrationRow[]);
  const taskRows = ((tasks ?? []) as TaskMigrationRow[]);
  const events: AuditEventInput[] = [
    {
      action: "settings.stage_migration_run",
      actor,
      after: {
        target_stage_id,
      },
      before: {
        origin_stage_id: id,
      },
      context,
      entityId: id,
      entityType: "client_pipeline_stage",
      metadata: {
        clientes_migrated: clientesMigrated,
        origin_stage_name: originRes.data.name,
        reason: migrationReason,
        target_stage_name: targetRes.data.name,
        tasks_migrated: tasksMigrated,
      },
      operationId,
    },
    ...clienteRows.map((cliente) => ({
      action: "cliente.stage_changed",
      actor,
      after: { current_stage_id: target_stage_id },
      before: { current_stage_id: cliente.current_stage_id },
      clienteId: cliente.id,
      context,
      entityId: cliente.id,
      entityType: "cliente",
      metadata: {
        migration: true,
        origin_stage_id: id,
        reason: migrationReason,
      },
      operationId,
    })),
    ...taskRows.map((task) => ({
      action: "task.stage_changed",
      actor,
      after: { pipeline_stage_id: target_stage_id },
      before: { pipeline_stage_id: task.pipeline_stage_id },
      clienteId: task.cliente_id,
      context,
      entityId: task.id,
      entityType: "production_task",
      metadata: {
        migration: true,
        origin_stage_id: id,
        reason: migrationReason,
        title: task.title,
      },
      operationId,
    })),
  ];
  await logAuditEvents(events);

  return NextResponse.json({
    ok: true,
    clientes_migrated: clientesMigrated,
    tasks_migrated: tasksMigrated,
    target_stage_id,
  });
}
