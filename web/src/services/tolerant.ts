import type { z } from "zod";

/*
 * Read a list one record at a time. `z.array(Schema).parse(items)` rejects the
 * whole array for one record with an enum this build does not know or a null
 * where a string was expected, and the author is left with an empty screen and
 * the validator's JSON. Here the odd record is dropped and counted, so a screen
 * can say "1 item could not be read" beside the rest.
 *
 * The count rides on the returned array (not in its shape), so a service keeps
 * returning a plain `T[]` and a cached list keeps its count.
 */

const skipped = new WeakMap<object, number>();

export function parseList<S extends z.ZodTypeAny>(schema: S, raw: unknown): z.infer<S>[] {
  if (!Array.isArray(raw)) throw new Error("The list came back in a shape this page could not be read.");
  const out: z.infer<S>[] = [];
  let bad = 0;
  for (const item of raw) {
    const r = schema.safeParse(item);
    if (r.success) out.push(r.data);
    else bad += 1;
  }
  if (bad > 0) skipped.set(out, bad);
  return out;
}

/** How many records `parseList` dropped from this list; 0 for any other array. */
export function unreadableCount(list: readonly unknown[] | null | undefined): number {
  return (list && skipped.get(list)) || 0;
}
