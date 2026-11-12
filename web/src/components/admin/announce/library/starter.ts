import type { AnnounceLibraryItem, AnnounceSnippet } from "@/services/adminAnnounce";

/*
 * The starter pack: ready-made templates and snippets the owner can merge into
 * the Library in one click. Wording is the owner's, kept as written. None is
 * a default; the built-in captions stay what the inbox writes until one is chosen.
 */
export const STARTER_TEMPLATES: readonly AnnounceLibraryItem[] = [
  { id: "st-li-launch-en", name: "Launch note", channel: "linkedin", lang: "en", text: "{title}\n\n{summary}\n\nWhat I learned building it, and what I would do differently:\n{url}\n\n{tags}" },
  { id: "st-li-short-en", name: "Short and direct", channel: "linkedin", lang: "en", text: "New on the blog: {title}\n\n{summary}\n\n{url}" },
  { id: "st-li-release-en", name: "Release", channel: "linkedin", lang: "en", text: "{title} {version} is out.\n\n{summary}\n\n{url}\n\n{tags}" },
  { id: "st-ig-en", name: "Caption with link in bio", channel: "instagram", lang: "en", text: "{title}\n\n{summary}\n\nLink in bio.\n.\n.\n{tags}" },
  { id: "st-x-line-en", name: "One line", channel: "x", lang: "en", text: "{title} {url}" },
  { id: "st-x-hook-en", name: "Hook", channel: "x", lang: "en", text: "{summary}\n\n{url}" },
  { id: "st-em-en", name: "Update email", channel: "email", lang: "en", text: "{title}\n\nHi,\n\n{summary}\n\nRead it here: {url}\n\n{site}" },
  { id: "st-li-launch-he", name: "פתיח לרשימה", channel: "linkedin", lang: "he", text: "{title}\n\n{summary}\n\nמה למדתי בדרך, ומה הייתי עושה אחרת:\n{url}\n\n{tags}" },
  { id: "st-li-short-he", name: "קצר וישיר", channel: "linkedin", lang: "he", text: "רשימה חדשה בבלוג: {title}\n\n{summary}\n\n{url}" },
  { id: "st-li-release-he", name: "גרסה חדשה", channel: "linkedin", lang: "he", text: "יצאה גרסה {version} של {title}.\n\n{summary}\n\n{url}\n\n{tags}" },
  { id: "st-ig-he", name: "כיתוב עם קישור בביו", channel: "instagram", lang: "he", text: "{title}\n\n{summary}\n\nהקישור בביו.\n.\n.\n{tags}" },
  { id: "st-x-line-he", name: "שורה אחת", channel: "x", lang: "he", text: "{title} {url}" },
  { id: "st-x-hook-he", name: "פתיח", channel: "x", lang: "he", text: "{summary}\n\n{url}" },
  { id: "st-em-he", name: "מייל עדכון", channel: "email", lang: "he", text: "{title}\n\nשלום,\n\n{summary}\n\nלקריאה: {url}\n\n{site}" },
];

export const STARTER_SNIPPETS: readonly AnnounceSnippet[] = [
  { id: "sn-tags-en", name: "Dev tags", kind: "hashtags", text: "#buildinpublic #webdev #typescript" },
  { id: "sn-sig-en", name: "Signature", kind: "signature", text: "Yehuda" },
  { id: "sn-cta-en", name: "Read the note", kind: "cta", text: "Read the full note:" },
  { id: "sn-tags-he", name: "תגיות פיתוח", kind: "hashtags", text: "#webdev #typescript #תכנות" },
  { id: "sn-sig-he", name: "חתימה", kind: "signature", text: "יהודה" },
  { id: "sn-cta-he", name: "קריאה לקריאה", kind: "cta", text: "לקריאת הרשימה המלאה:" },
];

export type StarterMerge = { templates: AnnounceLibraryItem[]; snippets: AnnounceSnippet[]; added: number; skipped: number };

/*
 * What merging would do, without doing it. Non-destructive: an id already in
 * the library is skipped, and so is a template whose name, channel and language
 * match one the owner already has (they probably added it by hand). Room left
 * under the backend limits caps what is added.
 */
export function planStarter(templates: readonly AnnounceLibraryItem[], snippets: readonly AnnounceSnippet[], maxTemplates = 100, maxSnippets = 50): StarterMerge {
  const key = (t: AnnounceLibraryItem) => [t.name.trim().toLowerCase(), t.channel, t.lang].join("|");
  const ids = new Set(templates.map((t) => t.id));
  const keys = new Set(templates.map(key));
  const addT: AnnounceLibraryItem[] = [];
  let skipped = 0;
  for (const t of STARTER_TEMPLATES) {
    if (ids.has(t.id) || keys.has(key(t)) || templates.length + addT.length >= maxTemplates) skipped++;
    else addT.push({ ...t, default: undefined });
  }
  const sIds = new Set(snippets.map((x) => x.id));
  const sKeys = new Set(snippets.map((x) => x.name.trim().toLowerCase() + "|" + x.kind));
  const addS: AnnounceSnippet[] = [];
  for (const x of STARTER_SNIPPETS) {
    if (sIds.has(x.id) || sKeys.has(x.name.trim().toLowerCase() + "|" + x.kind) || snippets.length + addS.length >= maxSnippets) skipped++;
    else addS.push({ ...x });
  }
  return { templates: addT, snippets: addS, added: addT.length + addS.length, skipped };
}
