/*
 * What Publish will change (#250): a line diff of the body, and a list of the
 * other fields that differ, shown before the author commits to it.
 *
 * A longest-common-subsequence diff over lines. Notes are a few hundred
 * lines, so the quadratic table is small; past LIMIT lines on either side it
 * stops comparing and says how many lines each version has, rather than
 * freezing the tab.
 */

import type { PostContent } from "@/services/admin";

export type DiffLine = { kind: "same" | "add" | "del"; text: string };
export type Hunk = { kind: "lines"; lines: DiffLine[] } | { kind: "skip"; count: number };

const LIMIT = 3000;

export function diffLines(before: string, after: string): DiffLine[] | null {
  const a = before === "" ? [] : before.split("\n");
  const b = after === "" ? [] : after.split("\n");
  if (a.length > LIMIT || b.length > LIMIT) return null;

  // Trim the common head and tail: most edits touch a few lines in the middle.
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  const A = a.slice(head, a.length - tail);
  const B = b.slice(head, b.length - tail);

  const n = A.length;
  const m = B.length;
  const w = m + 1;
  const t = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      t[i * w + j] = A[i] === B[j] ? t[(i + 1) * w + j + 1] + 1 : Math.max(t[(i + 1) * w + j], t[i * w + j + 1]);
    }
  }
  const mid: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      mid.push({ kind: "same", text: A[i] });
      i++;
      j++;
    } else if (t[(i + 1) * w + j] >= t[i * w + j + 1]) {
      mid.push({ kind: "del", text: A[i++] });
    } else {
      mid.push({ kind: "add", text: B[j++] });
    }
  }
  while (i < n) mid.push({ kind: "del", text: A[i++] });
  while (j < m) mid.push({ kind: "add", text: B[j++] });

  return [
    ...a.slice(0, head).map((text) => ({ kind: "same" as const, text })),
    ...mid,
    ...a.slice(a.length - tail).map((text) => ({ kind: "same" as const, text })),
  ];
}

/** Fold long runs of unchanged lines, keeping `context` lines around each change. */
export function hunks(lines: DiffLine[], context = 2): Hunk[] {
  const keep = lines.map(() => false);
  lines.forEach((l, i) => {
    if (l.kind === "same") return;
    for (let k = Math.max(0, i - context); k <= Math.min(lines.length - 1, i + context); k++) keep[k] = true;
  });
  const out: Hunk[] = [];
  let run: DiffLine[] = [];
  let skipped = 0;
  lines.forEach((l, i) => {
    if (keep[i]) {
      if (skipped) out.push({ kind: "skip", count: skipped });
      skipped = 0;
      run.push(l);
    } else {
      if (run.length) out.push({ kind: "lines", lines: run });
      run = [];
      skipped++;
    }
  });
  if (run.length) out.push({ kind: "lines", lines: run });
  if (skipped) out.push({ kind: "skip", count: skipped });
  return out;
}

export function counts(lines: DiffLine[]) {
  return {
    added: lines.filter((l) => l.kind === "add").length,
    removed: lines.filter((l) => l.kind === "del").length,
  };
}

const FIELDS = ["title", "subtitle", "excerpt", "tags", "collection", "coverImage", "featured", "publishedAt", "seo", "he", "links"] as const;

/** The fields other than the body that differ between two versions. */
export function changedFields(before: PostContent, after: PostContent) {
  return FIELDS.filter((k) => JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null));
}
