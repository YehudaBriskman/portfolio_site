/* Types for content-files.mjs, so the TypeScript test can import it. */

export interface LinkDraft {
  label: string;
  url: string;
}

/** An area's Hebrew, optional in its JSON. `linkLabels` follows `links`, by index. */
export interface AreaHebrewDraft {
  title?: string;
  tagline?: string;
  description?: string;
  linkLabels?: (string | null)[];
}

export interface AreaDraft {
  slug: string;
  title: string;
  tagline: string;
  kind: "site" | "project";
  description: string;
  coverImage: string | null;
  links: LinkDraft[];
  order: number;
  status: "published" | "hidden";
  repo: { owner: string; name: string; branch: string; docPaths: string[] } | null;
  he?: AreaHebrewDraft;
}

export interface NoteMeta {
  slug: string;
  title: string;
  subtitle: string | null;
  excerpt: string;
  tags: string[];
  collection: string;
  status: "draft" | "published" | "archived";
  publishedAt: string | null;
  readingMinutes: number;
  featured: number | null;
  coverImage: string | null;
  links: LinkDraft[];
  sources: LinkDraft[];
}

/** The header of a `<slug>.he.md` file. */
export interface NoteHebrewMeta {
  title: string;
  subtitle?: string | null;
  excerpt: string;
  linkLabels?: (string | null)[];
}

export interface NoteFile {
  file: string;
  folder: string;
  meta: NoteMeta;
  body: string;
  he: { file: string; meta: NoteHebrewMeta; body: string } | null;
}

export const HEBREW_SUFFIX: string;
export const CONTENT_DIR: string;
export function readingMinutes(body: string): number;
export function wordCount(body: string): number;
export function parseNote(text: string, file?: string): { meta: NoteMeta; body: string };
export function loadContent(root?: string): { areas: { file: string; data: AreaDraft }[]; posts: NoteFile[]; orphanHebrew: string[] };
export function toCollectionWrite(area: AreaDraft): Record<string, unknown>;
export function toPostWrite(post: NoteFile): Record<string, unknown>;
export function toPostHebrew(post: NoteFile): Record<string, string> | null;
export function toCollectionHebrew(area: AreaDraft): { he: Record<string, string> | null; linkLabels: (string | null)[] };
export function noteSlugFromFile(file: string): string;
export function hebrewSlugFromFile(file: string): string;
export function areaSlugFromFile(file: string): string;
