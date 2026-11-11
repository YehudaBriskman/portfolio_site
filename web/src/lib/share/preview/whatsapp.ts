import { PREVIEW_LIMITS as L } from "./constants";
import { cardOf, type LinkCard, type LinkMeta } from "./linkedin";
import { URL_RE, cpLength } from "./text";

export type WhatsAppSegment = { type: "text" | "link" | "bold" | "italic" | "strike"; text: string };

export type WhatsAppPreview = {
  /** Each line of the message as styled segments; text only, no markup. */
  lines: WhatsAppSegment[][];
  count: number;
  /** The first link, which WhatsApp turns into the card; null when none. */
  firstLink: string | null;
  card: LinkCard | null;
  /** Approximate length after which a phone shows "Read more". */
  foldAt: number;
  folded: boolean;
};

const STYLE_RE = /(\*[^*\s][^*]*\*|_[^_\s][^_]*_|~[^~\s][^~]*~)/u;

function segments(line: string): WhatsAppSegment[] {
  const out: WhatsAppSegment[] = [];
  let last = 0;
  const push = (type: WhatsAppSegment["type"], text: string) => text && out.push({ type, text });
  const plain = (s: string) =>
    s.split(STYLE_RE).forEach((part) => {
      const m = /^([*_~])(.+)\1$/u.exec(part);
      if (m && STYLE_RE.test(part)) push(m[1] === "*" ? "bold" : m[1] === "_" ? "italic" : "strike", m[2]);
      else push("text", part);
    });
  for (const m of line.matchAll(URL_RE)) {
    plain(line.slice(last, m.index));
    push("link", m[0]);
    last = (m.index ?? 0) + m[0].length;
  }
  plain(line.slice(last));
  return out;
}

export function previewWhatsApp(text: string, meta: LinkMeta = {}): WhatsAppPreview {
  const firstLink = text.match(URL_RE)?.[0] ?? meta.url ?? null;
  const count = cpLength(text);
  return {
    lines: text.split("\n").map(segments),
    count,
    firstLink,
    card: firstLink ? cardOf({ ...meta, url: meta.url ?? firstLink }) : null,
    foldAt: L.whatsappFoldChars,
    folded: count > L.whatsappFoldChars,
  };
}
