import { useEffect, useMemo, useState } from "react";

export interface PaginationState {
  page: number;
  pageSize: number;
  pageCount: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
}

export function usePaginatedTable<T>(items: T[], pageSizeOptions: number[] = [10, 25, 50, 100]) {
  const [page, setPageState] = useState(1);
  const [pageSize, setPageSize] = useState(pageSizeOptions[0] ?? 10);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(items.length / pageSize)), [items.length, pageSize]);

  useEffect(() => {
    if (page > pageCount) setPageState(pageCount);
    if (page < 1) setPageState(1);
  }, [page, pageCount]);

  const start = (page - 1) * pageSize;
  const end = Math.min(start + pageSize, items.length);
  const pagedItems = useMemo(() => items.slice(start, end), [items, start, end]);

  const setPage = (value: number) => {
    if (value >= 1 && value <= pageCount) setPageState(value);
  };

  const setPageSizeSafe = (size: number) => {
    const safe = pageSizeOptions.includes(size) ? size : pageSizeOptions[0];
    setPageState(1);
    setPageSize(safe);
  };

  return {
    page,
    pageSize,
    pageCount,
    startIndex: items.length > 0 ? start + 1 : 0,
    endIndex: end,
    pagedItems,
    pageSizeOptions,
    setPage,
    setPageSize: setPageSizeSafe,
  } as const;
}
