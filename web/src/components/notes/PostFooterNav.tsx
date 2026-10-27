import NoteCard from "@/components/notes/NoteCard";
import type { PostSummary } from "@/services/blog";

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
  if (!newer && !older) return null;
  return (
    <nav aria-label="More notes" className="mt-section-sm grid gap-6 sm:grid-cols-2">
      {newer && <NoteCard post={newer} compact label="Newer" />}
      {/* Held to the second column so "Older" stays on the right when it is
          the only neighbour — the direction is the whole signal. */}
      {older && (
        <div className={newer ? "" : "sm:col-start-2"}>
          <NoteCard post={older} compact label="Older" />
        </div>
      )}
    </nav>
  );
}
