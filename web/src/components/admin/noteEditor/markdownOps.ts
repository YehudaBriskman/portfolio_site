/*
 * The note editor's markdown edits (#250), as pure functions of the text and
 * the selection, so each one is testable without a textarea.
 *
 * Every op answers one edit: replace [from, to) with `text`, then select
 * [selStart, selEnd). The editor applies it through the browser's own
 * insertText, so Ctrl+Z undoes a toolbar action like any typing.
 */

export type Sel = { value: string; start: number; end: number };
export type Edit = { from: number; to: number; text: string; selStart: number; selEnd: number };

export type InlineOp = "bold" | "italic" | "code" | "strike";
export type LineOp = "h2" | "h3" | "quote" | "ul" | "ol" | "task";
export type Op = InlineOp | LineOp | "link" | "codeblock" | "wikilink";

const MARK: Record<InlineOp, string> = { bold: "**", italic: "_", code: "`", strike: "~~" };
const PREFIX: Record<LineOp, string> = { h2: "## ", h3: "### ", quote: "> ", ul: "- ", ol: "1. ", task: "- [ ] " };
/* Any prefix this toolbar writes, so switching a line from one to another
   replaces rather than stacks them. */
const ANY_PREFIX = /^(?:#{1,6} |> |- \[[ x]\] |- |\* |\d+\. )/;

/** Wrap the selection in a mark, or take the mark off when it is already on. */
function inline(s: Sel, op: InlineOp, placeholder: string): Edit {
  const m = MARK[op];
  const picked = s.value.slice(s.start, s.end);
  const before = s.value.slice(s.start - m.length, s.start);
  const after = s.value.slice(s.end, s.end + m.length);
  if (picked && before === m && after === m) {
    return { from: s.start - m.length, to: s.end + m.length, text: picked, selStart: s.start - m.length, selEnd: s.end - m.length };
  }
  if (picked.length > 2 * m.length && picked.startsWith(m) && picked.endsWith(m)) {
    const inner = picked.slice(m.length, -m.length);
    return { from: s.start, to: s.end, text: inner, selStart: s.start, selEnd: s.start + inner.length };
  }
  const word = picked || placeholder;
  return {
    from: s.start,
    to: s.end,
    text: `${m}${word}${m}`,
    selStart: s.start + m.length,
    selEnd: s.start + m.length + word.length,
  };
}

/** The whole lines the selection touches. */
function lineSpan(s: Sel) {
  const from = s.start === 0 ? 0 : s.value.lastIndexOf("\n", s.start - 1) + 1; // fromIndex -1 would clamp to 0
  const nl = s.value.indexOf("\n", s.end > s.start && s.value[s.end - 1] === "\n" ? s.end - 1 : s.end);
  return { from, to: nl === -1 ? s.value.length : nl };
}

/** Toggle a line prefix on every selected line. */
function lines(s: Sel, op: LineOp): Edit {
  const { from, to } = lineSpan(s);
  const rows = s.value.slice(from, to).split("\n");
  const want = PREFIX[op];
  /* Blank rows are separators inside a multi-line selection and are left alone,
     and they never decide whether the prefix is "already on". A selection with
     nothing but blank rows (the caret on an empty line) has no separators to
     protect, so there the blank rows take the prefix. */
  const filled = rows.filter((r) => r !== "");
  const allOn = filled.length > 0 && filled.every((r) => r.startsWith(want) || (op === "ol" && /^\d+\. /.test(r)));
  let n = 0;
  const out = rows.map((r) => {
    if (r === "" && filled.length > 0) return r;
    const bare = r.replace(ANY_PREFIX, "");
    if (allOn) return bare;
    n += 1;
    return (op === "ol" ? `${n}. ` : want) + bare;
  });
  const text = out.join("\n");
  return { from, to, text, selStart: from === to ? from + text.length : from, selEnd: from + text.length };
}

function link(s: Sel, placeholder: string): Edit {
  const picked = s.value.slice(s.start, s.end);
  const looksLikeUrl = /^https?:\/\/\S+$/.test(picked);
  if (looksLikeUrl) {
    const text = `[${placeholder}](${picked})`;
    return { from: s.start, to: s.end, text, selStart: s.start + 1, selEnd: s.start + 1 + placeholder.length };
  }
  const label = picked || placeholder;
  const text = `[${label}](https://)`;
  const at = s.start + label.length + 3; // past "[label]("
  return { from: s.start, to: s.end, text, selStart: at, selEnd: at + "https://".length };
}

function codeblock(s: Sel): Edit {
  const picked = s.value.slice(s.start, s.end);
  const lead = s.start > 0 && s.value[s.start - 1] !== "\n" ? "\n" : "";
  const text = `${lead}\`\`\`\n${picked}\n\`\`\`\n`;
  const at = s.start + lead.length + 4;
  return { from: s.start, to: s.end, text, selStart: at, selEnd: at + picked.length };
}

function wikilink(s: Sel): Edit {
  const picked = s.value.slice(s.start, s.end);
  const text = `[[${picked}`;
  return { from: s.start, to: s.end, text, selStart: s.start + text.length, selEnd: s.start + text.length };
}

export function edit(s: Sel, op: Op, placeholder = "text"): Edit {
  switch (op) {
    case "bold":
    case "italic":
    case "code":
    case "strike":
      return inline(s, op, placeholder);
    case "link":
      return link(s, placeholder);
    case "codeblock":
      return codeblock(s);
    case "wikilink":
      return wikilink(s);
    default:
      return lines(s, op);
  }
}

/** Apply an edit to a string: what a textarea without insertText falls back to. */
export function applyEdit(value: string, e: Edit): string {
  return value.slice(0, e.from) + e.text + value.slice(e.to);
}

/** The keyboard shortcuts, as Ctrl (or Cmd) plus a key. */
export const SHORTCUTS: Record<string, Op> = {
  b: "bold",
  i: "italic",
  k: "link",
  e: "code",
};

/** Markdown for a picture: alt text kept to one line, brackets escaped. */
export function imageMarkdown(alt: string, url: string): string {
  const a = alt.replace(/\s+/g, " ").replace(/([[\]\\])/g, "\\$1").trim();
  return `![${a}](${url})`;
}

/** "my-photo_02.png" -> "my photo 02", the alt text an upload starts with. */
export function altFromFile(name: string): string {
  return name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim() || "Picture";
}

/*
 * The open `[[` before the caret, if there is one: what the autocomplete
 * searches with and the span it replaces. Closed at the line's end and at
 * `]`, so it never reaches back into an earlier link.
 */
export function openWikilink(value: string, caret: number): { from: number; query: string } | null {
  const lineStart = value.lastIndexOf("\n", caret - 1) + 1;
  const before = value.slice(lineStart, caret);
  const m = /\[\[([^\]|[\n]{0,60})$/.exec(before);
  if (!m) return null;
  return { from: lineStart + m.index, query: m[1] };
}
