import { URL_RE } from "./text";
import { gmailComposeUrl, mailtoUrl, whatsappShareUrl, xShareUrl } from "./urls";
import type { ShareResult } from "./types";

/**
 * Where the send click goes once the person has edited the caption, or
 * undefined for channels with no web address (copy, native, Instagram).
 *
 * LinkedIn's dialog takes only the link, so its address does not change with
 * the text: the caller copies the text for pasting instead.
 */
export function sendHref(result: ShareResult, text: string): string | undefined {
  switch (result.channel) {
    case "linkedin":
      return result.href;
    case "email":
      return mailtoUrl(result.subject ?? "", text);
    case "gmail":
      return gmailComposeUrl(result.subject ?? "", text);
    case "x":
      // X takes the link as its own parameter, so it leaves the text.
      return xShareUrl(result.url, text.replace(URL_RE, "").replace(/\s+$/g, "").trim());
    case "whatsapp":
      return whatsappShareUrl(text);
    default:
      return undefined;
  }
}
