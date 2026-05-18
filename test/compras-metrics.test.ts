import { describe, expect, it } from "vitest";
import { computeComprasKpis } from "@/lib/compras/computeMetrics";
import type { Compra } from "@/lib/types";

describe("computeComprasKpis", () => {
  it("calcula total, média e sync", () => {
    const rows: Compra[] = [
      { dataCompra: "01/01/2026", valorTotalCompra: 100, atendySynced: true },
      { dataCompra: "02/01/2026", valorTotalCompra: 50, atendySynced: false },
      { dataCompra: "03/01/2026", valorTotalCompra: 50, atendySynced: true, numProposta: "x" },
    ];

    const result = computeComprasKpis(rows);
    expect(result.totalRegistros).toBe(3);
    expect(result.syncCount).toBe(2);
    expect(result.totalValor).toBe(200);
    expect(result.valorMedio).toBeCloseTo(66.666, 2);
  });

  it("sem dados retorna zero", () => {
    const result = computeComprasKpis([]);
    expect(result.totalRegistros).toBe(0);
    expect(result.syncCount).toBe(0);
    expect(result.totalValor).toBe(0);
    expect(result.valorMedio).toBe(0);
  });
});
