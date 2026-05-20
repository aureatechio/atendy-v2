export const SUPABASE_PAGE_SIZE = 1000;

type SupabasePageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

export async function fetchSupabaseAll<T>(
  fetchPage: (from: number, to: number) => PromiseLike<SupabasePageResult<T>>,
  pageSize: number = SUPABASE_PAGE_SIZE,
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) {
      throw new Error(`Supabase request failed: ${error.message}`);
    }

    const page = data ?? [];
    rows.push(...page);

    if (page.length < pageSize) break;
  }

  return rows;
}
