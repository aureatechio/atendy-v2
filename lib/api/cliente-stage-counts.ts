import { createClient } from "@/lib/supabase/server";

export interface ClienteCurrentStageCount {
  stageId: string;
  stageName: string;
  stageSlug: string;
  stageColor: string | null;
  stageOrderIndex: number;
  parentStageId: string | null;
  parentStageName: string | null;
  parentStageSlug: string | null;
  rootStageId: string;
  rootStageName: string;
  rootStageSlug: string;
  rootStageOrderIndex: number;
  isSubstage: boolean;
  activeClientCount: number;
  totalValue: number;
}

type ClienteCurrentStageCountRow = {
  stage_id: string;
  stage_name: string | null;
  stage_slug: string | null;
  stage_color: string | null;
  stage_order_index: number | null;
  parent_stage_id: string | null;
  parent_stage_name: string | null;
  parent_stage_slug: string | null;
  root_stage_id: string | null;
  root_stage_name: string | null;
  root_stage_slug: string | null;
  root_stage_order_index: number | null;
  is_substage: boolean | null;
  active_client_count: number | string | null;
  total_value: number | string | null;
};

function numberValue(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getClienteCurrentStageCounts(): Promise<ClienteCurrentStageCount[]> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Authenticated Supabase session is required for current stage counts.");
  }

  const { data, error } = await supabase
    .from("cliente_current_stage_counts")
    .select(
      "stage_id,stage_name,stage_slug,stage_color,stage_order_index,parent_stage_id,parent_stage_name,parent_stage_slug,root_stage_id,root_stage_name,root_stage_slug,root_stage_order_index,is_substage,active_client_count,total_value",
    );

  if (error) throw new Error(`Erro ao carregar contagem de etapas atuais: ${error.message}`);

  return ((data ?? []) as ClienteCurrentStageCountRow[])
    .map((row) => ({
      stageId: row.stage_id,
      stageName: row.stage_name ?? row.stage_slug ?? "Etapa sem nome",
      stageSlug: row.stage_slug ?? row.stage_id,
      stageColor: row.stage_color,
      stageOrderIndex: Number(row.stage_order_index ?? 0),
      parentStageId: row.parent_stage_id,
      parentStageName: row.parent_stage_name,
      parentStageSlug: row.parent_stage_slug,
      rootStageId: row.root_stage_id ?? row.stage_id,
      rootStageName: row.root_stage_name ?? row.stage_name ?? "Etapa sem nome",
      rootStageSlug: row.root_stage_slug ?? row.stage_slug ?? row.stage_id,
      rootStageOrderIndex: Number(row.root_stage_order_index ?? row.stage_order_index ?? 0),
      isSubstage: Boolean(row.is_substage),
      activeClientCount: numberValue(row.active_client_count),
      totalValue: numberValue(row.total_value),
    }))
    .sort((a, b) => {
      const rootOrder = a.rootStageOrderIndex - b.rootStageOrderIndex;
      if (rootOrder !== 0) return rootOrder;
      if (!a.isSubstage && b.isSubstage) return -1;
      if (a.isSubstage && !b.isSubstage) return 1;
      const stageOrder = a.stageOrderIndex - b.stageOrderIndex;
      if (stageOrder !== 0) return stageOrder;
      return a.stageName.localeCompare(b.stageName, "pt-BR");
    });
}
