import type { SigLang, SigSlotDoc } from "./schemas.js";
import { urlsOf } from "./schemas.js";
import { getShow, getSlot } from "./store.js";

/** What a page or a mail needs to draw the signature: only public facts about the rendered file. */
export type SigAsset = { src: string; srcLight: string | null; alt: string; width: number; height: number; format: "svg" | "png"; lang: SigLang };

const other = (l: SigLang): SigLang => (l === "he" ? "en" : "he");

/**
 * The signature for one use, in the reader's language, else the other
 * language's, else null (the caller then shows its typed text). Null as well
 * while that use is switched off, which is the default.
 */
export async function resolveSignature(use: "email" | "posts", lang: SigLang): Promise<SigAsset | null> {
  const show = await getShow();
  if (!show[use]) return null;
  const slot: SigSlotDoc | null = (await getSlot(lang)) ?? (await getSlot(other(lang)));
  if (!slot) return null;
  const u = urlsOf(slot);
  return { src: use === "email" ? u.email : u.web, srcLight: use === "email" ? u.emailLight : null, alt: slot.alt, width: slot.width, height: slot.height, format: slot.format, lang: slot.lang };
}
