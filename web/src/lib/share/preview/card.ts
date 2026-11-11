import type { CardFormat } from "../types";

/** `/api/seo/og/<kind>/<file>` with the format and language the server renders the card in. */
export function cardSrc(origin: string, kind: string, file: string, format: CardFormat, lang: "en" | "he"): string {
  const q = new URLSearchParams();
  if (format !== "og") q.set("format", format);
  q.set("lang", lang);
  return `${origin.replace(/\/+$/, "")}/api/seo/og/${encodeURIComponent(kind)}/${encodeURIComponent(file)}?${q}`;
}

