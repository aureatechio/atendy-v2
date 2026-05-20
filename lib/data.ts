import funilRaw from "@/data/funil.json";
import { type FunilData, type FunilStageMeta, type SlaUnit } from "@/lib/types";

type LegacyStageMeta = {
  slug: string;
  name: string;
  order_index: number;
  color: string;
  is_final: boolean;
  id?: string;
  parent_stage_id?: string | null;
  sla_amount?: number | null;
  sla_unit?: SlaUnit;
  warn_at_percent?: number;
};

const funilRawData = funilRaw as Omit<FunilData, "stages_meta" | "clients_map"> & {
  stages_meta: LegacyStageMeta[];
  clients_map?: FunilData["clients_map"];
};

const stagesMeta: FunilStageMeta[] = funilRawData.stages_meta.map((stage) => ({
  id: stage.id ?? stage.slug,
  slug: stage.slug,
  name: stage.name,
  order_index: stage.order_index,
  color: stage.color,
  is_final: stage.is_final,
  parent_stage_id: stage.parent_stage_id ?? null,
  sla_amount: stage.sla_amount ?? null,
  sla_unit: stage.sla_unit ?? "business_days",
  warn_at_percent: stage.warn_at_percent ?? 80,
  followup_days: null,
}));

const funilData: FunilData = {
  ...funilRawData,
  stages_meta: stagesMeta,
  clients_map: funilRawData.clients_map ?? {},
};

export async function getFunilDados(): Promise<FunilData> {
  return funilData;
}
