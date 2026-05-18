import { currencyFormatter } from "@/lib/utils";
import type { Compra } from "@/lib/types";

export function computeComprasKpis(rows: Compra[]) {
  const total = rows.length;
  const totalValor = rows.reduce((sum, row) => sum + Number(row.valorTotalCompra ?? 0), 0);
  const media = total > 0 ? totalValor / total : 0;
  const sincronizados = rows.filter((r) => r.atendySynced === true).length;

  return {
    totalRegistros: total,
    totalValor,
    valorMedio: media,
    syncCount: sincronizados,
    totalValorLabel: currencyFormatter.format(totalValor),
    valorMedioLabel: currencyFormatter.format(media),
  };
}
