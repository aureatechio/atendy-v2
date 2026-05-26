import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminAccess } from "@/lib/auth/requireAdmin";
import { migrateStageSchema } from "@/lib/sla/validation";
import { COMPLETED_TASK_STATUS } from "@/lib/production-tasks/status";

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
    return NextResponse.json({ error: "Etapa de origem não encontrada." }, { status: 404 });
  }
  if (targetRes.error || !targetRes.data) {
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
    .select("id")
    .eq("current_stage_id", id)
    .neq("is_archived", true);

  if (clientesError) {
    return NextResponse.json(
      { error: `Falha ao listar clientes: ${clientesError.message}` },
      { status: 500 },
    );
  }

  let clientesMigrated = 0;
  if (clientes && clientes.length > 0) {
    const clienteIds = clientes.map((c) => c.id);

    const { error: clientesUpdateError } = await admin
      .from("clientes_cadastro")
      .update({
        current_stage_id: target_stage_id,
        stage_entered_at: now,
        updated_at: now,
      })
      .in("id", clienteIds);

    if (clientesUpdateError) {
      return NextResponse.json(
        { error: `Falha ao migrar clientes: ${clientesUpdateError.message}` },
        { status: 500 },
      );
    }

    // Registra histórico (best-effort)
    const historyRows = clienteIds.map((clienteId) => ({
      cliente_id: clienteId,
      from_stage_id: id,
      to_stage_id: target_stage_id,
      changed_by: userId,
      action_type: "stage_change",
      reason: migrationReason,
      metadata: { migration: true, origin_stage_id: id },
    }));

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
    .select("id")
    .eq("pipeline_stage_id", id)
    .neq("status", COMPLETED_TASK_STATUS);

  if (tasksError) {
    return NextResponse.json(
      { error: `Falha ao listar tasks: ${tasksError.message}` },
      { status: 500 },
    );
  }

  let tasksMigrated = 0;
  if (tasks && tasks.length > 0) {
    const taskIds = tasks.map((t) => t.id);

    const { error: tasksUpdateError } = await admin
      .from("production_tasks")
      .update({
        pipeline_stage_id: target_stage_id,
        updated_at: now,
      })
      .in("id", taskIds);

    if (tasksUpdateError) {
      return NextResponse.json(
        { error: `Falha ao migrar tasks: ${tasksUpdateError.message}` },
        { status: 500 },
      );
    }

    const taskHistoryRows = taskIds.map((taskId) => ({
      task_id: taskId,
      from_stage_id: id,
      to_stage_id: target_stage_id,
      changed_by: userId,
      action_type: "stage_change",
      metadata: { migration: true, origin_stage_id: id, reason: migrationReason },
    }));

    const { error: taskHistoryError } = await admin
      .from("task_history")
      .insert(taskHistoryRows);
    if (taskHistoryError) {
      console.error("Falha ao registrar task_history na migração:", taskHistoryError);
    }
    tasksMigrated = taskIds.length;
  }

  return NextResponse.json({
    ok: true,
    clientes_migrated: clientesMigrated,
    tasks_migrated: tasksMigrated,
    target_stage_id,
  });
}
