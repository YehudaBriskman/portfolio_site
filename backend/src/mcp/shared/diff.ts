// GENERATED from mcp/src/diff.ts by mcp/scripts/sync-shared.mjs. Edit that file and rerun the script.
/*
 * Current vs proposed, field by field. A multi-line string (a post body) is
 * shown as a line diff rather than two copies of the whole text.
 */
export type FieldChange =
  | { field: string; before: unknown; after: unknown }
  | { field: string; lines: string[] };

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const MAX_LCS = 4_000_000;

/** Unified-style line diff: "  " kept, "- " removed, "+ " added. Unchanged runs are elided. */
export function lineDiff(a: string, b: string): string[] {
  const x = a.split("\n");
  const y = b.split("\n");
  if (x.length * y.length > MAX_LCS) {
    return [`(too long to diff line by line: ${x.length} -> ${y.length} lines)`];
  }
  const dp: number[][] = Array.from({ length: x.length + 1 }, () => new Array<number>(y.length + 1).fill(0));
  for (let i = x.length - 1; i >= 0; i--)
    for (let j = y.length - 1; j >= 0; j--)
      dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const raw: string[] = [];
  let i = 0;
  let j = 0;
  while (i < x.length && j < y.length) {
    if (x[i] === y[j]) (raw.push(`  ${x[i]}`), i++, j++);
    else if (dp[i + 1][j] >= dp[i][j + 1]) raw.push(`- ${x[i++]}`);
    else raw.push(`+ ${y[j++]}`);
  }
  while (i < x.length) raw.push(`- ${x[i++]}`);
  while (j < y.length) raw.push(`+ ${y[j++]}`);
  // Keep one line of context either side of a change.
  const keep = raw.map((l, k) => !l.startsWith("  ") || [raw[k - 1], raw[k + 1]].some((n) => n && !n.startsWith("  ")));
  const out: string[] = [];
  raw.forEach((l, k) => {
    if (keep[k]) out.push(l);
    else if (out.at(-1) !== "  ...") out.push("  ...");
  });
  return out;
}

export function diffFields(
  before: Record<string, unknown> | null,
  after: Record<string, unknown>,
  fields: readonly string[],
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const f of fields) {
    const a = before?.[f];
    const b = after[f];
    if (before && same(a, b)) continue;
    if (before && typeof a === "string" && typeof b === "string" && (a.includes("\n") || b.includes("\n"))) {
      changes.push({ field: f, lines: lineDiff(a, b) });
    } else {
      changes.push({ field: f, before: before ? (a ?? null) : null, after: b ?? null });
    }
  }
  return changes;
}
