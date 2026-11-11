import { channelLimit, countChars, hashtags, plain, renderWithin, URL_RE, type Vars } from "./text";
import { templateFor } from "./templates";
import { cardUrl, entityPath, entityUrl, gmailComposeUrl, linkedInShareUrl, localePath, mailtoUrl, whatsappShareUrl, xShareUrl } from "./urls";
import type { ShareInput, ShareResult } from "./types";

const SITE_NAME: Record<"en" | "he", string> = { en: "Yehuda Briskman", he: "יהודה בריסקמן" };

/**
 * Everything the UI needs to share one thing on one channel. Pure: no DOM,
 * no network. The address comes from `origin` + the kind and slug; the entity's
 * text only ever lands in `text`, `subject` and encoded query values.
 */
export function buildShare(input: ShareInput): ShareResult {
  const { kind, entity, locale, channel, audience, settings } = input;

  const utm = settings?.utm ?? { enabled: true, source: "share" };
  const url = entityUrl(input.origin, localePath(entityPath(kind, entity.slug), locale), utm.enabled ? { source: utm.source, medium: channel } : undefined);

  const vars: Vars = {
    title: plain(entity.title),
    summary: plain(entity.summary),
    url,
    tags: hashtags(entity.tags),
    version: plain(entity.version),
    site: plain(input.siteName) || SITE_NAME[locale],
  };

  const max = channelLimit(channel);
  const template = templateFor(audience, kind, locale, channel, settings);
  const rendered = renderWithin(template, vars, max, channel);

  let text = rendered;
  let subject: string | undefined;
  let href: string | undefined;
  let textPrefilled = true;

  switch (channel) {
    case "email":
    case "gmail": {
      const [first, ...rest] = rendered.split("\n");
      subject = plain(first);
      text = rest.join("\n").trim();
      href = channel === "gmail" ? gmailComposeUrl(subject, text) : mailtoUrl(subject, text);
      break;
    }
    case "linkedin":
      // The dialog reads only the URL; the caption has to be pasted by the person.
      href = linkedInShareUrl(url);
      textPrefilled = false;
      break;
    case "instagram":
      // No web intent exists: the card and the caption are the whole kit.
      textPrefilled = false;
      break;
    case "x":
      // X takes the link as its own parameter, so it leaves the text.
      href = xShareUrl(url, rendered.replace(URL_RE, "").replace(/\s+$/g, "").trim());
      break;
    case "whatsapp":
      href = whatsappShareUrl(rendered);
      break;
    case "native":
    case "copy":
      break;
  }

  const format = input.format ?? (channel === "instagram" ? "square" : "og");
  const count = countChars(text, channel);
  return {
    channel,
    url,
    href,
    text,
    subject,
    image: cardUrl(input.origin, kind, entity.slug, format),
    textPrefilled,
    limits: { max, count, over: max !== null && count > max },
  };
}
