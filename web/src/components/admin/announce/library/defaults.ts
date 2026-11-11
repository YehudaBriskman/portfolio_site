import type { AnnounceChannel, AnnounceLang } from "@/services/adminAnnounce";

/*
 * The built-in caption for a note, per language and channel: what the kit
 * writes when the owner has no template of their own. It mirrors
 * backend/src/announce/kit.ts (`withLead`, kind "post"); the server is the
 * source of truth and a release has its own wording there, so this is what
 * "Reset to default" shows and clears, not a second copy that is used.
 */
const LEAD: Record<AnnounceLang, string> = { en: "New on the blog: {title}", he: "חדש בבלוג: {title}" };
const IN_BIO: Record<AnnounceLang, string> = { en: "Link in bio.", he: "הקישור בביו." };

export function builtinTemplate(lang: AnnounceLang, channel: AnnounceChannel): string {
  const head = LEAD[lang];
  switch (channel) {
    case "linkedin":
      return `${head}\n\n{summary}\n\n{url}\n\n{tags}`;
    case "instagram":
      return `${head}\n\n{summary}\n\n${IN_BIO[lang]}\n\n{tags}`;
    case "email":
    case "gmail":
      return `${head}\n\n{summary}\n\n{url}`;
    case "x":
      return `${head} {url}`;
  }
}
