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
import { reorderStagesSchema } from "@/lib/sla/validation";

const stageColumns =
  "id, name, slug, color, order_index, is_final, is_active, parent_stage_id, sla_amount, sla_unit, warn_at_percent, followup_days, created_at, updated_at";

type ExistingStage = {
  id: string;
  is_final: boolean;
  is_active: boolean;
  name?: string | null;
  order_index?: number | null;
  parent_stage_id: string | null;
};

export async function POST(request: Request) {
  const access = await requireAdminAccess({ capability: "settingsArea" });
  if (access.error) return access.error;

  const parsed = reorderStagesSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }

  const { updates } = parsed.data;
  const ids = Array.from(new Set(updates.map((item) => item.id)));
  if (ids.length !== updates.length) {
    return NextResponse.json({ error: "IDs duplicados na requisição." }, { status: 400 });
  }

  const admin = createAdminClient();
  const operationId = createAuditOperationId();
  const [actor, context] = await Promise.all([getAuditActor(access.user), getAuditRequestContext()]);

  // Carrega todas as etapas envolvidas + todas que podem virar mãe (para validação)
  const { data: existing, error: existingError } = await admin
    .from("client_pipeline_stages")
    .select("id, name, order_index, is_final, is_active, parent_stage_id");

  if (existingError || !existing) {
    await logAuditEvent({
      action: "settings.stages_reordered",
      actor,
      context,
      entityType: "client_pipeline_stage",
      errorMessage: "Não foi possível carregar etapas para validação.",
      metadata: { update_count: updates.length },
      operationId,
      status: "failure",
    });
    return NextResponse.json(
      { error: "Não foi possível carregar etapas para validação." },
      { status: 500 },
    );
  }

  const byId = new Map<string, ExistingStage>(
    (existing as ExistingStage[]).map((stage) => [stage.id, stage]),
  );

  // Aplica os updates pendentes a um snapshot em memória para validar o estado final
  const projected = new Map<string, ExistingStage>(byId);
  for (const upd of updates) {
    const current = projected.get(upd.id);
    if (!current) {
      return NextResponse.json(
        { error: `Etapa ${upd.id} não encontrada.` },
        { status: 400 },
      );
    }
    projected.set(upd.id, { ...current, parent_stage_id: upd.parent_stage_id });
  }

  // Validações estruturais
  for (const upd of updates) {
    const current = byId.get(upd.id)!;

    // Não pode ser pai de si mesma
    if (upd.parent_stage_id === upd.id) {
      return NextResponse.json(
        { error: "Uma etapa não pode ser pai de si mesma." },
        { status: 400 },
      );
    }

    // is_final não pode virar subetapa
    if (current.is_final && upd.parent_stage_id !== null) {
      return NextResponse.json(
        { error: "Etapas finais não podem ser subetapas." },
        { status: 400 },
      );
    }

    // Pai precisa existir e ser ativo
    if (upd.parent_stage_id !== null) {
      const parent = projected.get(upd.parent_stage_id);
      if (!parent) {
        return NextResponse.json(
          { error: "Etapa-mãe informada não existe." },
          { status: 400 },
        );
      }
      if (!parent.is_active) {
        return NextResponse.json(
          { error: "Não é possível usar uma etapa inativa como mãe." },
          { status: 400 },
        );
      }
      // Regra de 2 níveis: o pai não pode ser ele próprio uma subetapa
      if (parent.parent_stage_id !== null) {
        return NextResponse.json(
          { error: "Hierarquia limitada a 2 níveis (etapa-mãe → subetapa)." },
          { status: 400 },
        );
      }
    }
  }

  // Se uma etapa ainda tem filhos no estado projetado, ela não pode virar subetapa
  const hasChildrenAfter = new Set<string>();
  for (const stage of projected.values()) {
    if (stage.parent_stage_id) hasChildrenAfter.add(stage.parent_stage_id);
  }
  for (const upd of updates) {
    if (upd.parent_stage_id !== null && hasChildrenAfter.has(upd.id)) {
      return NextResponse.json(
        {
          error:
            "Uma etapa-mãe que possui subetapas não pode virar subetapa (limite de 2 níveis).",
        },
        { status: 400 },
      );
    }
  }

  // Aplica os updates um a um (Supabase JS não tem transação multi-row nativa)
  const updatedAt = new Date().toISOString();
  const results: unknown[] = [];
  for (const upd of updates) {
    const { data, error } = await admin
      .from("client_pipeline_stages")
      .update({
        order_index: upd.order_index,
        parent_stage_id: upd.parent_stage_id,
        updated_at: updatedAt,
      })
      .eq("id", upd.id)
      .select(stageColumns)
      .single();

    if (error || !data) {
      await logAuditEvent({
        action: "settings.stages_reordered",
        actor,
        context,
        entityType: "client_pipeline_stage",
        errorMessage: error?.message ?? `Falha ao atualizar etapa ${upd.id}.`,
        metadata: {
          failed_stage_id: upd.id,
          partial_count: results.length,
          update_count: updates.length,
        },
        operationId,
        status: "failure",
      });
      return NextResponse.json(
        {
          error:
            error?.message ?? `Falha ao atualizar etapa ${upd.id}.`,
          partial: results,
        },
        { status: 500 },
      );
    }
    results.push(data);
  }

  const beforeById = new Map<string, ExistingStage>(
    (existing as ExistingStage[]).map((stage) => [stage.id, stage]),
  );
  const events: AuditEventInput[] = [
    {
      action: "settings.stages_reordered",
      actor,
      context,
      entityType: "client_pipeline_stage",
      metadata: {
        changed_count: results.length,
        update_count: updates.length,
      },
      operationId,
    },
  ];

  for (const row of results as AuditJsonObject[]) {
    const previous = beforeById.get(String(row.id));
    if (!previous) continue;
    if (previous.order_index === row.order_index && previous.parent_stage_id === row.parent_stage_id) continue;
    events.push({
      action: "settings.stage_position_changed",
      actor,
      after: {
        order_index: row.order_index ?? null,
        parent_stage_id: row.parent_stage_id ?? null,
      },
      before: {
        order_index: previous.order_index ?? null,
        parent_stage_id: previous.parent_stage_id ?? null,
      },
      context,
      entityId: String(row.id),
      entityType: "client_pipeline_stage",
      metadata: {
        name: row.name ?? previous.name ?? null,
      },
      operationId,
    });
  }

  await logAuditEvents(events);

  return NextResponse.json({ stages: results });
}
