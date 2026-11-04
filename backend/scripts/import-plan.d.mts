/* Types for import-plan.mjs, so the TypeScript test can import it. */
import type { AreaDraft, NoteFile } from "./content-files.mjs";

export type HebrewAction = { field: string; action: "add" | "overwrite" | "kept" };
export type Options = { overwriteHe?: boolean };
type Raw = Record<string, any>;

export interface PlanItem {
  kind: "collection" | "post";
  slug: string;
  existing: Raw | undefined;
  draft: Raw;
  diff: { key: string; from: unknown; to: unknown }[];
  hebrew: HebrewAction[];
  /** A note's Hebrew to publish, or null for none. */
  he?: Record<string, string> | null;
  notes: string[];
}

export const POST_HE_FIELDS: string[];
export const AREA_HE_FIELDS: string[];
export function mergeHebrew(
  fromRepo: Record<string, unknown> | null | undefined,
  inStore: Record<string, unknown> | null | undefined,
  fields: string[],
  opts?: Options,
): { merged: Record<string, string>; actions: HebrewAction[] };
export function comparableLinks(links: unknown[] | null | undefined): { label: { en: string; he?: string }; url: string }[];
export function planArea(data: AreaDraft, existing: Raw | undefined, opts?: Options): PlanItem;
export function planPost(post: NoteFile, existing: Raw | undefined, opts?: Options): PlanItem;
export function hebrewPublishBody(doc: Raw, he: Record<string, string>): Raw;
export function buildPlan(
  content: { areas: { data: AreaDraft }[]; posts: NoteFile[] },
  live: { liveAreas: Raw[]; livePosts: Raw[] },
  opts?: Options,
): PlanItem[];
export function needsWrite(item: PlanItem): boolean;
export function describePlan(plan: PlanItem[], opts?: Options): string[];
export function applyPlan(
  plan: PlanItem[],
  api: (method: string, path: string, body?: unknown) => Promise<Raw>,
  log?: (line: string) => void,
): Promise<number>;
