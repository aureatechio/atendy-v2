import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminAccess } from "@/lib/auth/requireAdmin";
import { updateStageSchema } from "@/lib/sla/validation";
import { COMPLETED_TASK_STATUS } from "@/lib/production-tasks/status";

const stageColumns =
  "id, name, slug, color, order_index, is_final, is_active, parent_stage_id, sla_amount, sla_unit, warn_at_percent, followup_days, created_at, updated_at";

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
  const { data, error } = await admin
    .from("client_pipeline_stages")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(stageColumns)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Nao foi possivel atualizar a etapa." }, { status: 400 });
  }

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
    return NextResponse.json({ error: error?.message ?? "Nao foi possivel desativar a etapa." }, { status: 400 });
  }

  return NextResponse.json({ stage: data });
}
