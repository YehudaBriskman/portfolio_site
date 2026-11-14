import { Link } from "react-router-dom";
import Shot from "@/components/projects/Shot";
import { StatChip } from "@/components/ui/StatChip";
import { languageColour } from "@/components/work/language";
import { toneOfKind } from "@/components/phone/tone";
import { count } from "@/components/dashboard/i18n";
import { kindOf } from "@/components/projects/catalogue";
import { isPinned } from "@/components/work/order";
import { stateWord, useWorkWords } from "@/components/work/words";
import type { ProjectEntry } from "@/hooks/useProjects";
import styles from "@/components/phone/ProjectCard.module.css";
import "@/components/phone/tokens.css";

/*
 * A project on a phone (public mobile guide, W2): the cover leads, then the
 * name and a status mark, then at most three facts. The whole card is ONE
 * link to the project; everything the desktop card also prints (description,
 * forks, when it moved, the tag link, Notes, the status word) is on the
 * project page and is not repeated here.
 *
 * COVER. The project's own screenshot at 16:10; without one, a tile made only
 * of the project's state hue and its initial, so a coverless card is the same
 * shape as a covered one and never blank.
 *
 * STATUS. A shape plus a hue, and the word for a screen reader: live is a
 * disc, in use a diamond, open source a square, a release a triangle, the
 * rest a ring. Colour is never the only cue.
 *
 * `dir="auto"` on every content string: a Hebrew page shows English titles
 * and versions in their own direction instead of mirroring them.
 */

type Shape = "disc" | "diamond" | "square" | "triangle" | "ring";
const SHAPE: Record<string, Shape> = { live: "disc", use: "diamond", open: "square", release: "triangle", rest: "ring" };

/* Two 16px stroke glyphs drawn here (lucide's star and tag shapes): the icon
   vocabulary in ui/icons.ts would need a concept and a word for each, and a
   stat chip's word is the sr-only label it already has. */
type GlyphProps = { className?: string };
const Star = ({ className }: GlyphProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />
  </svg>
);
const Tag = ({ className }: GlyphProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z" />
    <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
  </svg>
);

function StatusMark({ kind, word }: { kind: string; word: string }) {
  const shape = SHAPE[kind] ?? "ring";
  return (
    <span className={styles.status} data-status="" data-shape={shape} data-tone={toneOfKind(kind)} title={word}>
      <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true" focusable="false">
        {shape === "disc" && <circle cx="5" cy="5" r="4.5" />}
        {shape === "ring" && <circle cx="5" cy="5" r="3.75" />}
        {shape === "diamond" && <polygon points="5,0.5 9.5,5 5,9.5 0.5,5" />}
        {shape === "square" && <polygon points="1,1 9,1 9,9 1,9" />}
        {shape === "triangle" && <polygon points="5,0.5 9.5,9 0.5,9" />}
      </svg>
      <span className="sr-only">{word}</span>
    </span>
  );
}

export default function ProjectCard({ entry, headingLevel = 3 }: { entry: ProjectEntry; headingLevel?: 3 | 4 }) {
  const [t, lang] = useWorkWords();
  const c = entry.collection;
  const s = c.stats;
  const kind = kindOf(entry.state);
  const H = headingLevel === 3 ? "h3" : "h4";
  const release = s?.latestRelease ?? null;
  const colour = languageColour(s?.language);

  /* The dot of a language is its own chip glyph: StatChip draws any icon it is given. */
  const LangDot = ({ className }: { className?: string }) => (
    <span
      className={`${className ?? ""} ${styles.langDot}`}
      style={colour ? { backgroundColor: colour } : undefined}
      aria-hidden="true"
    />
  );

  return (
    <article className={styles.card} data-project-card="" data-pinned={isPinned(entry) ? "" : undefined}>
      <Link to={`/projects/${c.slug}`} className={styles.link}>
        {c.coverImage ? (
          <div className={styles.cover} data-cover="image">
            <Shot src={c.coverImage} alt="" className="h-full w-full" sizes="(max-width: 639px) calc(100vw - 32px), 400px" />
          </div>
        ) : (
          <div className={styles.cover} data-cover="glyph" data-tone={toneOfKind(kind)} aria-hidden="true">
            <span dir="auto">{c.title.trim().slice(0, 1).toUpperCase()}</span>
          </div>
        )}
        <div className={styles.body}>
          <div className={styles.nameRow}>
            <H className={styles.name} dir="auto" translate="no">
              {c.title}
            </H>
            <StatusMark kind={kind} word={stateWord(entry.state, lang)} />
          </div>
          <div className={styles.stats}>
            {s?.language && (
              <span data-stat="" className={styles.stat} dir="auto" translate="no">
                <StatChip icon={LangDot} value={s.language} label="" />
              </span>
            )}
            {s?.stars != null && s.stars > 0 && (
              <span data-stat="" className={styles.stat}>
                <StatChip icon={Star} value={count(s.stars, lang)} label={lang === "he" ? " כוכבים" : " stars"} />
              </span>
            )}
            {release && (
              <span data-stat="" className={styles.stat} dir="auto" translate="no">
                <StatChip icon={Tag} value={release.tag} label={t.release} />
              </span>
            )}
          </div>
        </div>
      </Link>
    </article>
  );
}
