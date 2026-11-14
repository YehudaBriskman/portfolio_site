import NoteCard from "@/components/notes/NoteCard";
import type { PostSummary } from "@/services/blog";
import { useNotesWords } from "@/i18n/pages";
import reader from "@/components/notes/reader/Reader.module.css";

/*
 * A post used to be a dead end: nothing after the tags but whitespace and the
 * browser's back button. Neighbours are derived from the collection listing the
 * page already knows how to fetch, so this costs one request and no new API.
 */
export default function PostFooterNav({
  newer,
  older,
}: {
  newer: PostSummary | null;
  older: PostSummary | null;
}) {
  const w = useNotesWords();
  if (!newer && !older) return null;
  return (
    <nav aria-label={w.more} className={`mt-section-sm grid gap-6 sm:grid-cols-2 ${reader.related}`}>
      {newer && <NoteCard post={newer} compact label={w.newer} />}
      {/*
       * Held to the second column so "Older" stays on the right when it is
       * the only neighbour — the direction is the whole signal.
       *
       * The placement is a class on the card rather than a wrapping div, and
       * that is not tidying. A card's resting wash comes from `nth-child`, so
       * a card that is the only child of a div is always position one: with
       * the wrapper here, "Newer" and "Older" both came out blue and the pair
       * read as one object cut in half.
       */}
      {older && (
        <NoteCard post={older} compact label={w.older} className={newer ? "" : "sm:col-start-2"} />
      )}
    </nav>
  );
}
