import { adminAudience, type Contact, type ContactLang, type ContactPage, type ContactQuery } from "@/services/adminAudience";

/* How many pages one fill may read. A language that almost nobody has must not turn one click into a scan of the whole list. */
const MAX_PAGES = 8;
const PAGE = 25;

/*
 * One screenful of contacts. The list endpoint has no language filter, so a language is applied here; a page that
 * is all the other language would show zero rows with no way on. Follow the cursor until a page fills, the list
 * ends, or the read budget is spent (the cursor is then kept, so "Load more" carries on from there).
 */
export async function fillPage(query: ContactQuery, lang: ContactLang | ""): Promise<ContactPage> {
  const items: Contact[] = [];
  let cursor = query.cursor ?? null;
  for (let i = 0; i < MAX_PAGES; i++) {
    const p = await adminAudience.contacts({ ...query, cursor });
    items.push(...(lang ? p.items.filter((c) => c.lang === lang) : p.items));
    cursor = p.nextCursor;
    if (!cursor || !lang || items.length >= PAGE) break;
  }
  return { items, nextCursor: cursor };
}
