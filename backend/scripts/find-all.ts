export type FindPage = (bookmark?: string) => Promise<{ docs: unknown[]; bookmark?: string }>;

/** Reads every page of a Mango query: CouchDB caps one _find at `limit`, so follow bookmarks until a page is short. */
export async function findAll<T>(page: FindPage, limit: number): Promise<T[]> {
  const out: T[] = [];
  let bookmark: string | undefined;
  for (;;) {
    const r = await page(bookmark);
    out.push(...(r.docs as T[]));
    if (r.docs.length < limit || !r.bookmark || r.bookmark === bookmark) return out;
    bookmark = r.bookmark;
  }
}
