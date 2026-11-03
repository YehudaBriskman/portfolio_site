import NoteCard from "@/components/notes/NoteCard";
import NoteGlyph from "@/components/notes/NoteGlyph";
import type { PostSummary } from "@/services/blog";
import { useHomeWords } from "@/i18n/pages";

/*
 * The shared list of notes, used by the blog index and by each project page.
 *
 * Kept as a component with this exact signature because Project.tsx renders it
 * too; the change here is entirely internal — hairline rows became cards, and
 * the empty state became something designed rather than one grey sentence,
 * since a first visit to a young project is the state most likely to be seen.
 */
export default function PostList({ posts }: { posts: PostSummary[] }) {
  const w = useHomeWords();
  if (posts.length === 0) {
    return (
      <div className="note-card mt-3 flex flex-col items-center px-6 py-12 text-center">
        <div className="w-48 overflow-hidden rounded-[var(--r-md)] opacity-40 sm:w-64">
          <div className="aspect-[16/9]">
            <NoteGlyph seed="empty" />
          </div>
        </div>
        <h2 className="display-tight mt-12 text-xl text-bone sm:text-2xl">{w.emptyTitle}</h2>
        <p className="mt-6 max-w-sm text-[0.9375rem] leading-relaxed text-bone/70">
          {w.emptyBody}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      {posts.map((p) => (
        <NoteCard key={p.slug} post={p} />
      ))}
    </div>
  );
}
