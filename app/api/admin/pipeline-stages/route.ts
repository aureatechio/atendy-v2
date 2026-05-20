import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireAdminAccess } from "@/lib/auth/requireAdmin";
import { createStageSchema } from "@/lib/sla/validation";

const stageColumns =
  "id, name, slug, color, order_index, is_final, is_active, parent_stage_id, sla_amount, sla_unit, warn_at_percent, followup_days, created_at, updated_at";

export async function GET() {
  const access = await requireAdminAccess({ roles: ["admin", "supervisor"] });
  if (access.error) return access.error;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_pipeline_stages")
    .select(stageColumns)
    .order("parent_stage_id", { ascending: true, nullsFirst: true })
    .order("order_index", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Nao foi possivel listar etapas." }, { status: 500 });
  }

  return NextResponse.json({ stages: data ?? [] });
}

export async function POST(request: Request) {
  const access = await requireAdminAccess();
  if (access.error) return access.error;

  const parsed = createStageSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados invalidos." }, { status: 400 });
  }

  const admin = createAdminClient();
  const payload = {
    ...parsed.data,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await admin
    .from("client_pipeline_stages")
    .insert(payload)
    .select(stageColumns)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Nao foi possivel criar a etapa." }, { status: 400 });
  }

  return NextResponse.json({ stage: data });
}
