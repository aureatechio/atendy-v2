import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminAccess } from "@/lib/auth/requireAdmin";
import { updateStageSchema } from "@/lib/sla/validation";

const stageColumns =
  "id, name, slug, color, order_index, is_final, is_active, parent_stage_id, sla_amount, sla_unit, warn_at_percent, created_at, updated_at";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireAdminAccess();
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

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireAdminAccess();
  if (access.error) return access.error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID obrigatorio." }, { status: 400 });
  }

  const admin = createAdminClient();
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
