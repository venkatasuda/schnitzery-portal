// Callers provide a stable order. Reuse the query sequentially; range replaces
// its offset and limit without changing the caller's filters or RLS session.
export async function readAll<T>(query: {
  range(from: number, to: number): PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
}): Promise<{ data: T[] | null; error: { message: string } | null }> {
  const rows: T[] = [];
  // ponytail: 100k-row ceiling; use database aggregates beyond this size.
  for (let offset = 0; offset <= 100000; offset += 1000) {
    const { data, error } = await query.range(offset, offset === 100000 ? offset : offset + 999);
    if (error) return { data: null, error };
    if (rows.length + (data?.length || 0) > 100000) break;
    rows.push(...(data || []));
    if (!data || data.length < 1000) return { data: rows, error: null };
  }
  return { data: null, error: { message: "Report exceeds 100,000 rows; narrow the period." } };
}
