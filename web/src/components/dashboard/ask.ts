/*
 * The ask box's little language (#224): words are a search, `#word` is a
 * topic and `@word` is an area. A `#` or `@` word that names nothing known
 * stays a search word without its sigil, so nothing typed is ever dropped.
 */

export type AskOption = { value: string; label: string };

export type Asked = { q: string; tags: string[]; areas: string[] };

const norm = (s: string) => s.trim().toLocaleLowerCase();

function find(word: string, options: AskOption[]): string | undefined {
  const w = norm(word);
  if (!w) return undefined;
  return (
    options.find((o) => norm(o.value) === w || norm(o.label) === w)?.value ??
    options.find((o) => norm(o.value).replace(/[\s-]+/g, "") === w.replace(/[\s-]+/g, ""))?.value
  );
}

export function parseAsk(text: string, topics: AskOption[], areas: AskOption[]): Asked {
  const tags: string[] = [];
  const picked: string[] = [];
  const words: string[] = [];
  for (const raw of text.split(/\s+/).filter(Boolean)) {
    const sigil = raw[0];
    const rest = raw.slice(1);
    if (sigil === "#" || sigil === "@") {
      const hit = find(rest, sigil === "#" ? topics : areas);
      const into = sigil === "#" ? tags : picked;
      if (hit) {
        if (!into.includes(hit)) into.push(hit);
        continue;
      }
      if (rest) words.push(rest);
      continue;
    }
    words.push(raw);
  }
  return { q: words.join(" "), tags, areas: picked };
}

/** The word being typed at the end of the box, if it is a `#` or `@` word. */
export function pendingSigil(text: string): { sigil: "#" | "@"; word: string } | null {
  const m = /(?:^|\s)([#@])([^\s#@]*)$/.exec(text);
  if (!m) return null;
  return { sigil: m[1] as "#" | "@", word: m[2] };
}

export function suggest(text: string, topics: AskOption[], areas: AskOption[], max = 6): AskOption[] {
  const p = pendingSigil(text);
  if (!p) return [];
  const pool = p.sigil === "#" ? topics : areas;
  const w = norm(p.word);
  const starts = pool.filter((o) => norm(o.value).startsWith(w) || norm(o.label).startsWith(w));
  const contains = pool.filter((o) => !starts.includes(o) && (norm(o.value).includes(w) || norm(o.label).includes(w)));
  return [...starts, ...contains].slice(0, max);
}

/** The box with its pending word completed. */
export function complete(text: string, option: AskOption): string {
  const p = pendingSigil(text);
  if (!p) return text;
  const token = option.value.replace(/\s+/g, "-");
  return `${text.slice(0, text.length - p.word.length)}${token} `;
}
