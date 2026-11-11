/*
 * Every number the previews use, in one place.
 *
 * APPROXIMATE. The limits are published by the platforms and have been stable
 * (LinkedIn 3000, Instagram 2200 and 30 hashtags, X 280 with a link counted as
 * 23). The FOLD positions are not published: they are what each platform
 * happens to show before "see more", they differ between the phone and the
 * desktop and they change without notice. They are measured by eye, so the UI
 * says "approximate" and nothing may depend on them being exact. Change them
 * here only; `constants.test.ts` pins them so a change is deliberate.
 */
export const PREVIEW_LIMITS = {
  /** Post length cap. */
  linkedin: 3000,
  /** Characters shown before "see more" (desktop is about 210, a phone about 140). */
  linkedinFoldChars: 210,
  /** Lines shown before "see more". */
  linkedinFoldLines: 3,
  /** Post length cap, with every link counted as `xLinkWeight`. */
  x: 280,
  xLinkWeight: 23,
  /** Room kept at the end of each post of a thread for " (12/12)". */
  xThreadSuffixReserve: 8,
  /** Caption length cap. */
  instagram: 2200,
  /** Characters of caption shown before "more". */
  instagramFoldChars: 125,
  /** Hashtags beyond this are ignored by Instagram. */
  instagramHashtags: 30,
  /** WhatsApp shows a link card under the first link; nothing is folded. */
  whatsappFoldChars: 700,
} as const;
