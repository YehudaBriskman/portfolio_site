import { logger } from "../logger.js";
import { SITE_URL } from "../services/seo.js";
import { emailService } from "../services/email.service.js";
import { buildOwnerEmail } from "./emailHtml.js";
import { renderKit } from "./kit.js";
import type { AnnounceEvent, AnnounceSettings } from "./schemas.js";

/*
 * One mail per event (HTML with a plain-text part), to CONTACT_TO (the service's only recipient). No
 * `replyTo`: that field is what makes the service send a visitor an
 * auto-reply, and this mail is the owner's own notification. A failure is
 * logged, never thrown, so it cannot undo a publish or stop a refresh tick.
 */
export async function notifyOwner(ev: AnnounceEvent, settings: AnnounceSettings): Promise<void> {
  try {
    const kit = renderKit(ev, settings);
    const { subject, html, text } = buildOwnerEmail(ev, kit, SITE_URL);
    await emailService.send({ subject, html, text });
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err), id: ev._id }, "announce: owner email failed");
  }
}
