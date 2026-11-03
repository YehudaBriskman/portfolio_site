import { Link } from "react-router-dom";
import { BookMarked, GitFork, Star, Tag } from "lucide-react";
import styles from "@/components/work/Work.module.css";
import SkeletonGate from "@/components/gallery/SkeletonGate";
import SkeletonLines from "@/components/gallery/SkeletonLines";
import { count, fullDate, relative } from "@/components/dashboard/i18n";
import { kindOf } from "@/components/projects/catalogue";
import type { ProjectEntry } from "@/hooks/useProjects";
import type { ActivityEvent } from "@/services/activity";
import { isPinned, updatedAt } from "@/components/work/order";
import { stateWord, useWorkWords } from "@/components/work/words";
import { languageColour } from "@/components/work/language";

/*
 * A project as GitHub's repository card (#227): the name and a status pill
 * on the first line, one line of what it is, the year of its repository on a
 * hairline, and the facts row — language, stars, forks, when it last moved,
 * its latest release. Two ways out: the project, and its notes area.
 *
 * WHAT IS PRINTED ONCE. The facts row carries the words ("Updated 3 days
 * ago", "v1.9.0"); the strip above it carries the *shape* of the year — how
 * often, how recently — and says the same events to a screen reader as a
 * list. A seed-only project has neither, and its card says nothing about
 * them rather than printing dashes: a repository card for something with no
 * repository would be inventing a field.
 *
 * COLOUR. The language dot (GitHub's own colour for that language, because
 * that is what the dot means to anyone who has seen one) and the status
 * pill's dot. The pill's word is always printed, so the hue only groups.
 */

const YEAR = 365 * 86_400_000;

/**
 * A year of the repository on one hairline: a dot per push, a tick per
 * release, placed by date. In Hebrew the axis runs the other way, because
 * the positions are logical (`inset-inline-start`).
 */
export function ActivityStrip({
  events,
  now,
  busy,
}: {
  events: ActivityEvent[] | undefined;
  now: number;
  busy?: boolean;
}) {
  const [t, lang] = useWorkWords();
  if (busy) {
    return (
      <SkeletonGate className={styles.stripSkeleton}>
        <SkeletonLines lines={1} tail="100%" />
      </SkeletonGate>
    );
  }
  const within = (events ?? []).filter((e) => now - Date.parse(e.at) <= YEAR && Date.parse(e.at) <= now);
  return (
    <div className={styles.strip} data-empty={within.length === 0 ? "" : undefined}>
      <span className={styles.stripTrack} aria-hidden="true" />
      {within.length === 0 ? (
        <span className={styles.stripEmpty}>{t.stripEmpty}</span>
      ) : (
        <ol className={styles.stripEvents} aria-label={t.strip}>
          {within.map((e) => {
            const at = Math.min(100, Math.max(0, (1 - (now - Date.parse(e.at)) / YEAR) * 100));
            const what = e.kind === "release" ? t.released(String(e.meta.tag ?? e.title)) : t.pushed;
            return (
              <li
                key={e.id}
                className={styles.stripEvent}
                data-kind={e.kind}
                style={{ insetInlineStart: `${at}%` }}
                title={`${what} · ${fullDate(e.at, lang)}`}
              >
                <span className={styles.stripMark} aria-hidden="true" />
                <span className="sr-only">{`${what}, ${relative(e.at, now, lang)}`}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export default function RepoCard({
  entry,
  events,
  eventsBusy,
  hasArea,
  now,
  headingLevel = 3,
}: {
  entry: ProjectEntry;
  /** This project's pushes and releases, newest first; undefined while loading. */
  events: ActivityEvent[] | undefined;
  eventsBusy: boolean;
  /** Whether `/blog/area/:slug` exists for it. */
  hasArea: boolean;
  now: number;
  headingLevel?: 3 | 4;
}) {
  const [t, lang] = useWorkWords();
  const c = entry.collection;
  const s = c.stats;
  const H = headingLevel === 3 ? "h3" : "h4";
  const updated = updatedAt(entry);
  const release = s?.latestRelease ?? null;
  const colour = languageColour(s?.language);
  const linked = Boolean(c.repoUrl || s);

  return (
    <article className={styles.card} data-pinned={isPinned(entry) ? "" : undefined}>
      <div className={styles.cardHead}>
        <BookMarked className={styles.cardIcon} size={16} aria-hidden="true" />
        <H className={styles.cardName}>
          <Link to={`/projects/${c.slug}`} translate="no">
            {c.title}
          </Link>
        </H>
        <span className={styles.pill} data-kind={kindOf(entry.state)}>
          {stateWord(entry.state, lang)}
        </span>
      </div>

      {c.tagline && <p className={styles.cardLine}>{c.tagline}</p>}

      {linked && <ActivityStrip events={events} now={now} busy={eventsBusy} />}

      <div className={styles.facts}>
        {s?.language && (
          <span className={styles.fact}>
            <span
              className={styles.langDot}
              aria-hidden="true"
              style={colour ? { backgroundColor: colour } : undefined}
            />
            <span translate="no">{s.language}</span>
          </span>
        )}
        {s?.stars != null && s.stars > 0 && (
          <span className={styles.fact} title={t.stars(count(s.stars, lang))}>
            <Star size={14} aria-hidden="true" />
            <span className={styles.num}>{count(s.stars, lang)}</span>
            <span className="sr-only">{lang === "he" ? " כוכבים" : " stars"}</span>
          </span>
        )}
        {s?.forks != null && s.forks > 0 && (
          <span className={styles.fact} title={t.forks(count(s.forks, lang))}>
            <GitFork size={14} aria-hidden="true" />
            <span className={styles.num}>{count(s.forks, lang)}</span>
            <span className="sr-only">{lang === "he" ? " פיצולים" : " forks"}</span>
          </span>
        )}
        {updated && (
          <span className={styles.fact}>
            <time dateTime={updated} title={fullDate(updated, lang)}>
              {t.updated(relative(updated, now, lang))}
            </time>
          </span>
        )}
        {release && (
          <a
            className={styles.release}
            href={release.url}
            rel="noopener noreferrer"
            aria-label={`${t.release}: ${release.tag}`}
          >
            <Tag size={14} aria-hidden="true" />
            <span dir="ltr" translate="no">
              {release.tag}
            </span>
          </a>
        )}
        {hasArea && (
          <Link className={styles.notes} to={`/blog/area/${c.slug}`} aria-label={t.notesLinkFor(c.title)}>
            {t.notesLink}
          </Link>
        )}
      </div>
    </article>
  );
}
