import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminAccess } from "@/lib/auth/requireAdmin";
import { COMPLETED_TASK_STATUS } from "@/lib/production-tasks/status";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireAdminAccess({ capability: "settingsArea" });
  if (access.error) return access.error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Conta clientes ativos (não arquivados) na etapa
  const clientesQuery = admin
    .from("clientes_cadastro")
    .select("id", { count: "exact", head: true })
    .eq("current_stage_id", id)
    .neq("is_archived", true);

  // Conta tasks de produção não concluídas na etapa
  const tasksQuery = admin
    .from("production_tasks")
    .select("id", { count: "exact", head: true })
    .eq("pipeline_stage_id", id)
    .neq("status", COMPLETED_TASK_STATUS);

  // Conta subetapas ativas
  const substagesQuery = admin
    .from("client_pipeline_stages")
    .select("id", { count: "exact", head: true })
    .eq("parent_stage_id", id)
    .eq("is_active", true);

  const [clientesRes, tasksRes, substagesRes] = await Promise.all([
    clientesQuery,
    tasksQuery,
    substagesQuery,
  ]);

  if (clientesRes.error || tasksRes.error || substagesRes.error) {
    return NextResponse.json(
      {
        error:
          clientesRes.error?.message ??
          tasksRes.error?.message ??
          substagesRes.error?.message ??
          "Falha ao calcular impacto.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    stage_id: id,
    clientes_count: clientesRes.count ?? 0,
    tasks_count: tasksRes.count ?? 0,
    substages_count: substagesRes.count ?? 0,
    can_deactivate:
      (clientesRes.count ?? 0) === 0 &&
      (tasksRes.count ?? 0) === 0 &&
      (substagesRes.count ?? 0) === 0,
  });
}
