import { PREVIEW_LIMITS as L } from "./constants";
import { cpLength, cutAtWord, hashtagsOf } from "./text";

export type InstagramPreview = {
  /** The caption up to the fold, cut at a word. */
  visible: string;
  /** What sits behind "more". */
  hidden: string;
  folded: boolean;
  hashtags: string[];
  hashtagLimit: number;
  hashtagsOver: boolean;
  count: number;
  limit: number;
  over: boolean;
};

/* Approximate: the fold is the first ~125 characters, cut at a word. */
export function previewInstagram(text: string): InstagramPreview {
  const { head } = cutAtWord(text, L.instagramFoldChars);
  const folded = head.length < text.length;
  const hashtags = hashtagsOf(text);
  const count = cpLength(text);
  return {
    visible: folded ? head : text,
    hidden: folded ? text.slice(head.length).replace(/^\s+/u, "") : "",
    folded,
    hashtags,
    hashtagLimit: L.instagramHashtags,
    hashtagsOver: hashtags.length > L.instagramHashtags,
    count,
    limit: L.instagram,
    over: count > L.instagram,
  };
}
