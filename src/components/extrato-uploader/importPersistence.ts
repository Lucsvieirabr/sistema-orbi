export interface ImportFailure { id: string; description: string; date: string; reason: string }

/** Preserve source IDs across chunk fallback, deletions and partial-save retries. */
export async function insertImportChunks<Row>(
  rows: Row[],
  originals: { id: string; description: string; date: string }[],
  insert: (rows: Row[]) => PromiseLike<{ error: unknown }>,
  describeError: (error: unknown) => string,
  shouldStop: (error: unknown) => boolean,
  chunkSize = 50,
) {
  const savedIds = new Set<string>();
  const failures: ImportFailure[] = [];
  const attempt = async (chunk: Row[]) => {
    try { return await insert(chunk); } catch (error) { return { error }; }
  };
  const fail = (index: number, reason: string) => failures.push({ ...originals[index], reason });
  for (let start = 0; start < rows.length; start += chunkSize) {
    const chunk = rows.slice(start, start + chunkSize);
    const { error } = await attempt(chunk);
    if (!error) {
      chunk.forEach((_, i) => savedIds.add(originals[start + i].id));
      continue;
    }
    if (shouldStop(error)) {
      for (let i = start; i < rows.length; i++) fail(i, describeError(error));
      break;
    }
    for (let offset = 0; offset < chunk.length; offset++) {
      const { error: rowError } = await attempt([chunk[offset]]);
      if (!rowError) savedIds.add(originals[start + offset].id);
      else {
        fail(start + offset, describeError(rowError));
        if (shouldStop(rowError)) {
          for (let rest = start + offset + 1; rest < rows.length; rest++) fail(rest, 'Não enviada: o erro acima interrompeu a importação.');
          return { savedIds, failures };
        }
      }
    }
  }
  return { savedIds, failures };
}

export async function readAllPages<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, size = 500): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await fetchPage(from, from + size - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < size) return rows;
  }
}
