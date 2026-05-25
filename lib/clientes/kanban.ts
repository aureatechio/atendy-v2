import type { ClienteListItem, ClienteStageSummary } from "@/lib/clientes/types";

export const CLIENTES_NO_STAGE_COLUMN_ID = "__no_stage__";

export interface ClientesKanbanColumn {
  id: string;
  name: string;
  color: string;
  orderIndex: number;
  isFinal: boolean;
  count: number;
  totalValue: number;
  items: ClienteListItem[];
}

const NO_STAGE_COLOR = "#94a3b8";

function summarizeColumn(column: Omit<ClientesKanbanColumn, "count" | "totalValue">): ClientesKanbanColumn {
  return {
    ...column,
    count: column.items.length,
    totalValue: column.items.reduce((sum, item) => sum + item.valor, 0),
  };
}

export function buildClientesKanbanColumns(
  rows: ClienteListItem[],
  stages: ClienteStageSummary[],
): ClientesKanbanColumn[] {
  const activeStages = stages
    .filter((stage) => stage.is_active)
    .sort((a, b) => a.order_index - b.order_index);

  const stageIds = new Set(activeStages.map((stage) => stage.id));
  const itemsByStage = new Map<string, ClienteListItem[]>();
  const noStageItems: ClienteListItem[] = [];

  for (const row of rows) {
    if (row.stageId && stageIds.has(row.stageId)) {
      const items = itemsByStage.get(row.stageId) ?? [];
      items.push(row);
      itemsByStage.set(row.stageId, items);
      continue;
    }
    noStageItems.push(row);
  }

  const columns = activeStages.map((stage) =>
    summarizeColumn({
      id: stage.id,
      name: stage.name,
      color: stage.color,
      orderIndex: stage.order_index,
      isFinal: stage.is_final,
      items: itemsByStage.get(stage.id) ?? [],
    }),
  );

  if (noStageItems.length > 0) {
    columns.push(
      summarizeColumn({
        id: CLIENTES_NO_STAGE_COLUMN_ID,
        name: "Sem etapa",
        color: NO_STAGE_COLOR,
        orderIndex: Number.MAX_SAFE_INTEGER,
        isFinal: false,
        items: noStageItems,
      }),
    );
  }

  return columns;
}
