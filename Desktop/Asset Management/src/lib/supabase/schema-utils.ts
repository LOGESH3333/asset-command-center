/** Detect PostgREST schema-cache errors for a missing column. */
export function isMissingColumnError(message: string, column: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes(column.toLowerCase()) &&
    (lower.includes('schema cache') || lower.includes('could not find'))
  );
}

/** Parse column name from PostgREST "Could not find the 'X' column" errors. */
export function parseMissingColumnName(message: string): string | null {
  const match = message.match(/Could not find the '([^']+)' column/i);
  return match?.[1] ?? null;
}

/** Remove a missing column from payload and retry insert/update until success or non-schema error. */
export async function mutateWithSchemaFallback<T>(
  attempt: (payload: Record<string, unknown>) => Promise<{ data: T | null; error: { message: string } | null }>,
  payload: Record<string, unknown>,
  protectedKeys: string[] = ['name']
): Promise<{ data: T | null; error: { message: string } | null }> {
  let current = { ...payload };
  const maxAttempts = Object.keys(current).length + 2;

  for (let i = 0; i < maxAttempts; i++) {
    const { data, error } = await attempt(current);
    if (!error) return { data, error: null };

    const missing = parseMissingColumnName(error.message);
    if (missing && missing in current && !protectedKeys.includes(missing)) {
      delete current[missing];
      continue;
    }
    return { data, error };
  }

  return { data: null, error: { message: 'Failed after schema fallback retries' } };
}
