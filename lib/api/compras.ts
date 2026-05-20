import { fetchCrmCompras, type CrmCompraRow } from "@/lib/crm/compras";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchSupabaseAll } from "@/lib/supabase/paginate";
import { mapToCompra, type AtendyStageInfo, type AtendyStageMap } from "@/lib/compras/mapping";
import type { Compra } from "@/lib/types";

type AtendyClienteRow = {
  id: string;
  code: string | null;
  nomecliente: string | null;
  created_at: string | null;
  current_stage_id: string | null;
  stage: {
    id: string;
    name: string | null;
    order_index: number | null;
    color: string | null;
    is_final: boolean | null;
  } | null;
};

async function fetchAtendyStageMap(rows: CrmCompraRow[]): Promise<AtendyStageMap> {
  const propostaIds = rows
    .map((row) => row.imagem?.id)
    .filter((id): id is number => typeof id === "number");

  if (propostaIds.length === 0) {
    return new Map();
  }

  const codes = Array.from(new Set(propostaIds.map((id) => String(id))));

  const supabase = createAdminClient();
  const clientes = await fetchSupabaseAll<AtendyClienteRow>((from, to) =>
    supabase
      .from("clientes_cadastro")
      .select(
        "id, code, nomecliente, created_at, current_stage_id, stage:client_pipeline_stages!clientes_cadastro_current_stage_id_fkey ( id, name, order_index, color, is_final )",
      )
      .in("code", codes)
      .range(from, to)
      .returns<AtendyClienteRow[]>(),
  );

  const byCode = new Map<string, AtendyClienteRow>();
  for (const cliente of clientes) {
    if (cliente.code) byCode.set(cliente.code, cliente);
  }

  const map: AtendyStageMap = new Map();
  for (const row of rows) {
    const propostaId = row.imagem?.id;
    if (propostaId == null) continue;
    const cliente = byCode.get(String(propostaId));
    if (!cliente) continue;

    const info: AtendyStageInfo = {
      clienteId: cliente.id,
      code: cliente.code ?? String(propostaId),
      nomecliente: cliente.nomecliente,
      createdAt: cliente.created_at,
      stageId: cliente.stage?.id ?? cliente.current_stage_id,
      stageName: cliente.stage?.name ?? null,
      stageOrder: cliente.stage?.order_index ?? null,
      stageColor: cliente.stage?.color ?? null,
      stageIsFinal: cliente.stage?.is_final ?? null,
    };
    map.set(row.id, info);
  }

  return map;
}

export async function getCompras(): Promise<Compra[]> {
  const crmRows = await fetchCrmCompras();
  const stageMap = await fetchAtendyStageMap(crmRows);
  return crmRows.map((row) => mapToCompra(row, stageMap));
}
