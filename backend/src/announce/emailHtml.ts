import type { AnnounceEvent } from "./schemas.js";
import type { Kit, KitItem } from "./kit.js";

/*
 * The owner's announce mail as an email-client-safe page: tables, inline CSS,
 * no scripts or external assets beyond the card image. Every dynamic value goes
 * through `esc`; URLs are SITE_URL plus a validated slug, never raw input.
 */

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ESC[c]);

/** Same shape the OG route accepts for a file name (slugs and release tags). */
const SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

function origin(siteUrl: string): string {
  const u = new URL(siteUrl);
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("SITE_URL must be http(s)");
  return u.origin;
}

export function cardUrl(ev: Pick<AnnounceEvent, "kind" | "ref">, siteUrl: string): string | null {
  if (!SLUG.test(ev.ref)) return null;
  const kind = ev.kind === "release" ? "release" : "blog";
  return `${origin(siteUrl)}/api/seo/og/${kind}/${encodeURIComponent(ev.ref)}.png?format=og`;
}

export const adminUrl = (siteUrl: string) => `${origin(siteUrl)}/admin/announce`;

type Caption = { label: string; lang: "en" | "he"; item: KitItem };

const LABELS = { linkedin: "LinkedIn", x: "X", email: "Email" } as const;

function captions(kit: Kit): Caption[] {
  const out: Caption[] = [];
  for (const lang of ["en", "he"] as const) {
    const k = kit[lang];
    const pick: Array<[string, KitItem | undefined]> = [
      [LABELS.linkedin, k.linkedin],
      [LABELS.x, k.x],
      [LABELS.email, k.gmail ?? k.email],
    ];
    for (const [label, item] of pick) if (item) out.push({ label: lang === "he" ? `${label} (Hebrew)` : label, lang, item });
  }
  return out;
}

const FONT = "font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";
const br = (s: string) => esc(s).replace(/\r?\n/g, "<br>");
/* Each line is its own bidi unit, so a Latin-only line (URL, hashtags) inside a Hebrew block keeps its own direction. */
const lines = (s: string) =>
  s
    .split(/\r?\n/)
    .map((l) => `<div dir="auto" style="min-height:1.55em;">${l ? esc(l) : "&nbsp;"}</div>`)
    .join("");

function captionBlock(c: Caption): string {
  const he = c.lang === "he";
  const count = c.item.limit === null ? "" : ` &middot; ${c.item.length}/${c.item.limit}${c.item.over ? " (over the limit)" : ""}`;
  return `<tr><td class="card" style="padding:0 24px 16px 24px;background-color:#ffffff;">
<div class="mut" style="${FONT}font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#4b5563;padding-bottom:6px;">${esc(c.label)}${count}</div>
<div class="cap" ${he ? 'dir="rtl" lang="he" ' : 'lang="en" '}style="${FONT}font-size:15px;line-height:1.55;color:#111827;background-color:#f3f4f6;border:1px solid #d1d5db;border-radius:8px;padding:12px 14px;text-align:${he ? "right" : "left"};">${lines(c.item.text)}</div>
</td></tr>`;
}

export function buildOwnerEmail(ev: AnnounceEvent, kit: Kit, siteUrl: string): { subject: string; html: string; text: string } {
  const subject = ev.kind === "release" ? `${ev.title} is out` : `New on the blog: ${ev.title}`;
  const img = cardUrl(ev, siteUrl);
  const admin = adminUrl(siteUrl);
  const kindLabel = ev.kind === "release" ? `New version${ev.version ? ` ${ev.version}` : ""}` : "New post";
  const caps = captions(kit);
  const heTitle = ev.titleHe && ev.titleHe !== ev.title ? ev.titleHe : "";

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<title>${esc(subject)}</title>
<style>
:root{color-scheme:light dark;supported-color-schemes:light dark;}
@media (prefers-color-scheme: dark){
.page{background-color:#0b0f19 !important;}
.card{background-color:#161b26 !important;}
.tx{color:#f3f4f6 !important;}
.tx2{color:#d1d5db !important;}
.mut{color:#9ca3af !important;}
.cap{background-color:#222a3a !important;border-color:#3b4558 !important;color:#f3f4f6 !important;}
.btn{background-color:#60a5fa !important;}
.btna{color:#0b1220 !important;}
}
</style></head>
<body class="page" style="margin:0;padding:0;background-color:#e5e7eb;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="page" style="background-color:#e5e7eb;"><tr><td align="center" style="padding:16px 8px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border-radius:10px;overflow:hidden;" class="card">
<tr><td class="card mut" style="padding:20px 24px 8px 24px;background-color:#ffffff;${FONT}font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#4b5563;">${esc(kindLabel)}</td></tr>
${img ? `<tr><td class="card" style="padding:0;background-color:#ffffff;"><img src="${esc(img)}" width="600" alt="${esc(`Share card: ${ev.title}`)}" style="display:block;width:100%;max-width:600px;height:auto;border:0;"></td></tr>` : ""}
<tr><td class="card tx" style="padding:16px 24px 4px 24px;background-color:#ffffff;${FONT}font-size:22px;line-height:1.3;font-weight:700;color:#111827;">${esc(ev.title)}</td></tr>
${heTitle ? `<tr><td class="card tx" dir="rtl" lang="he" style="padding:0 24px 4px 24px;background-color:#ffffff;${FONT}font-size:20px;line-height:1.3;font-weight:700;color:#111827;text-align:right;">${esc(heTitle)}</td></tr>` : ""}
${ev.summary ? `<tr><td class="card tx2" style="padding:4px 24px 16px 24px;background-color:#ffffff;${FONT}font-size:15px;line-height:1.55;color:#374151;">${br(ev.summary)}</td></tr>` : ""}
<tr><td class="card" style="padding:4px 24px 20px 24px;background-color:#ffffff;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td class="btn" bgcolor="#1d4ed8" style="background-color:#1d4ed8;border-radius:8px;"><a class="btna" href="${esc(admin)}" style="display:inline-block;padding:14px 24px;${FONT}font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">Open the Announce inbox</a></td></tr></table></td></tr>
${caps.map(captionBlock).join("\n")}
<tr><td class="card mut" style="padding:8px 24px 20px 24px;background-color:#ffffff;${FONT}font-size:12px;line-height:1.5;color:#6b7280;">Nothing is posted for you. Copy a caption, post it yourself, then mark it done in the inbox.</td></tr>
</table></td></tr></table></body></html>`;

  const textBlocks = caps.map((c) => `${c.label}:\n${c.item.text}`);
  const text = [
    `${kindLabel}: ${ev.title}`,
    heTitle,
    ev.summary,
    img ? `Card image: ${img}` : "",
    ...textBlocks,
    `Open the Announce inbox: ${admin}`,
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");

  return { subject, html, text };
}

