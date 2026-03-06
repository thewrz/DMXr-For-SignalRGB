/** Truncate a UUID/ID to its first 8 characters for log readability. */
export function shortId(id: string): string {
  return id.slice(0, 8);
}
