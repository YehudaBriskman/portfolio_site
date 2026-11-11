import { logger } from "../logger.js";
import { SITE_URL } from "../services/seo.js";
import { emailService } from "../services/email.service.js";
import { renderKit } from "./kit.js";
import type { AnnounceEvent, AnnounceSettings } from "./schemas.js";

/*
 * One mail per event, to CONTACT_TO (the service's only recipient). No
 * `replyTo`: that field is what makes the service send a visitor an
 * auto-reply, and this mail is the owner's own notification. A failure is
 * logged, never thrown, so it cannot undo a publish or stop a refresh tick.
 */
export async function notifyOwner(ev: AnnounceEvent, settings: AnnounceSettings): Promise<void> {
  try {
    const kit = renderKit(ev, settings);
    const first = kit.en;
    const parts = [
      first.linkedin && `LinkedIn:\n${first.linkedin.text}`,
      first.gmail && `Email:\n${first.gmail.text}`,
      `Open the Announce inbox: ${SITE_URL}/admin/announce`,
    ].filter(Boolean);
    const subject = ev.kind === "release" ? `${ev.title} is out` : `New on the blog: ${ev.title}`;
    await emailService.send({ subject, text: parts.join("\n\n---\n\n") });
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err), id: ev._id }, "announce: owner email failed");
  }
}
