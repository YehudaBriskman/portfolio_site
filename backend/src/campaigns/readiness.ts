import { createHash } from "node:crypto";
import type { Campaign } from "./schemas.js";

/*
 * What a test send proves: that THIS content was mailed to the owner. The
 * fingerprint covers everything a recipient reads, so an edit after the test
 * makes the campaign untested again. Groups and topic are not part of the mail.
 */
export const contentFingerprint = (c: Pick<Campaign, "subject" | "preheader" | "bodyText" | "blocks" | "lang">): string =>
  createHash("sha256").update(JSON.stringify([c.subject, c.preheader ?? "", c.bodyText, c.blocks ?? null, c.lang ?? "all"])).digest("hex").slice(0, 32);

export const isTested = (c: Campaign): boolean => c.tested?.fp === contentFingerprint(c);
