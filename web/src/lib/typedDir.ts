/**
 * The `dir` for a field whose text may be in either language: `auto` once
 * the reader has typed something with a direction of its own, and nothing
 * (the page's direction, inherited) until then.
 *
 * Why not `dir="auto"` on its own: `auto` decides from the field's *value*,
 * never from its placeholder, and a value with no strong character in it —
 * the empty field, or a lone `#` — resolves to left-to-right. So on /he the
 * empty notes search set its Hebrew placeholder LTR, flush left with its
 * ellipsis at the wrong end, on a page that reads the other way.
 *
 * Inheriting while there is nothing to decide from puts the placeholder on
 * the page's side; `auto` once there is a letter keeps what `auto` was for —
 * an English query on the Hebrew page still reads left to right. A letter is
 * the test because letters are the strong characters in practice: digits,
 * spaces and the `#`/`@` sigils are weak or neutral and decide nothing.
 */
export function typedDir(value: string): "auto" | undefined {
  return /\p{L}/u.test(value) ? "auto" : undefined;
}
