import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useComprasFilters } from "@/hooks/useComprasFilters";
import { usePaginatedTable } from "@/hooks/usePaginatedTable";
import type { Compra } from "@/lib/types";

describe("useComprasFilters", () => {
  const rows: Compra[] = [
    {
      dataCompra: "10/01/2026",
      cliente: "Alice",
      vendedor: "João",
      valorTotalCompra: 100,
      numProposta: "A3",
    },
    {
      dataCompra: "11/01/2026",
      cliente: "Bruno",
      vendedor: "Ana",
      valorTotalCompra: 300,
      numProposta: "A1",
    },
    {
      dataCompra: "12/01/2026",
      cliente: "Carol",
      vendedor: "Ana",
      valorTotalCompra: 200,
      numProposta: "A2",
    },
  ];

  it("filtra por busca textual", () => {
    const { result } = renderHook(() => useComprasFilters(rows));

    act(() => result.current.setFilter("search", "bruno"));
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0].cliente).toBe("Bruno");
  });

  it("aplica período customizado", () => {
    const { result } = renderHook(() => useComprasFilters(rows));

    act(() => result.current.setFilter("period", "custom"));
    act(() => result.current.setFilter("periodFrom", "2026-01-11"));
    act(() => result.current.setFilter("periodTo", "2026-01-11"));

    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0].numProposta).toBe("A1");
  });

  it("ordenação retorna ordem original após ciclo asc -> desc -> none", () => {
    const { result } = renderHook(() => useComprasFilters(rows));

    act(() => result.current.setFilter("sortKey", "numProposta"));
    act(() => result.current.setFilter("sortDir", "asc"));
    expect(result.current.rows.map((item) => item.numProposta)).toEqual(["A1", "A2", "A3"]);

    act(() => result.current.setFilter("sortDir", "desc"));
    expect(result.current.rows.map((item) => item.numProposta)).toEqual(["A3", "A2", "A1"]);

    act(() => result.current.setFilter("sortDir", "none"));
    expect(result.current.rows.map((item) => item.numProposta)).toEqual(["A3", "A1", "A2"]);
  });
});

describe("usePaginatedTable", () => {
  it("controla página e tamanho", () => {
    const rows = Array.from({ length: 12 }).map((_, i) => ({ id: i + 1 }));
    const { result } = renderHook(() => usePaginatedTable(rows, [5, 10]));

    expect(result.current.page).toBe(1);
    expect(result.current.pageCount).toBe(3);
    expect(result.current.pagedItems).toHaveLength(5);

    act(() => result.current.setPage(2));
    expect(result.current.page).toBe(2);

    act(() => result.current.setPageSize(10));
    expect(result.current.pageSize).toBe(10);
    expect(result.current.pagedItems).toHaveLength(10);
  });
});
