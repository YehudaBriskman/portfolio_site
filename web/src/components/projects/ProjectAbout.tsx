import { useState, type ReactNode } from "react";
import GroupedSection from "@/components/phone/GroupedSection";
import ListRow from "@/components/phone/ListRow";
import { useHistoryWords } from "@/components/dashboard/historyWords";
import { count as countFmt, relative, shortDate } from "@/components/dashboard/i18n";
import { areaFeedUrl } from "@/services/activity";
import type { Lang } from "@/components/dashboard/i18n";
import styles from "@/components/projects/ProjectAbout.module.css";
import page from "@/pages/Project.module.css";

/*
 * The project page's About card on a phone, and the label/value rows Details
 * shares with it (data-display skill).
 *
 *   - a <dl> of <div> rows: the label at the start, the value at the end of
 *     the same line, whatever the page's direction;
 *   - direction by what a value IS: a licence, a path and a bare count are
 *     `dir="ltr"` (a count also `tabular-nums`); a phrase with a digit in it
 *     ("5 days ago") is Hebrew prose and carries nothing;
 *   - an unset value is one dash, never a missing row;
 *   - a datum is said once on the page: language, stars and the version are
 *     the header's chips and forks are in Details, so none is repeated here,
 *     and the repository is a row here only when Details does not hold it;
 *   - the "as of" stamp is one small muted line, not a sentence.
 */

/** The one placeholder for a field that exists but has no value. */
const EMPTY = "—";

export function FactRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.fact}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.value}>{children}</dd>
    </div>
  );
}

/* The dash is drawn as is; its accessible name says what it means. */
function Empty() {
  const [hw] = useHistoryWords();
  return (
    <span className={styles.empty} role="img" aria-label={hw.notAvailable}>
      {EMPTY}
    </span>
  );
}

/** A count: a number, so left-to-right with tabular figures. */
export function CountValue({ n, lang }: { n: number; lang: Lang }) {
  return (
    <span dir="ltr" className={styles.num}>
      {countFmt(n, lang)}
    </span>
  );
}

export function FactList({ children }: { children: ReactNode }) {
  return <dl className={styles.facts}>{children}</dl>;
}

type Stats = {
  license?: string | null;
  pushedAt?: string | null;
  fetchedAt?: string | null;
};

export default function ProjectAbout({
  heading,
  headingId,
  lang,
  stats,
  repoUrl,
  repoInDetails,
  slug,
  live,
  words,
  icons,
}: {
  heading: string;
  headingId: string;
  lang: Lang;
  stats: Stats | null;
  repoUrl: string | null;
  /** Details already holds the repository link: do not say it twice. */
  repoInDetails: boolean;
  slug: string;
  live: boolean;
  words: { areaNotes: string; repository: string; feed: string };
  /** Drawn by the page (this file adds no direct icon-library import). */
  icons: { notes: ReactNode; repo: ReactNode; feed: ReactNode };
}) {
  const [hw] = useHistoryWords();
  const [now] = useState(() => Date.now());
  const hasRows = live || (repoUrl && !repoInDetails);
  return (
    <div className={styles.about} data-phone="about">
      <section className={styles.card} aria-labelledby={headingId}>
        <h2 id={headingId} className={styles.title}>
          {heading}
        </h2>
        {stats && (
          <>
            <FactList>
              <FactRow label={hw.pushed}>
                {stats.pushedAt ? <time dateTime={stats.pushedAt}>{relative(stats.pushedAt, now, lang)}</time> : <Empty />}
              </FactRow>
              <FactRow label={hw.licence}>
                {stats.license ? (
                  <span dir="ltr" translate="no">
                    {stats.license}
                  </span>
                ) : (
                  <Empty />
                )}
              </FactRow>
            </FactList>
            {stats.fetchedAt && (
              <p className={styles.stamp} data-phone="about-stamp">
                <time dateTime={stats.fetchedAt}>{hw.asOf(shortDate(stats.fetchedAt, lang))}</time>
              </p>
            )}
          </>
        )}
      </section>
      {hasRows && (
        <GroupedSection>
          <ul className={page.list}>
            {live && (
              <li>
                <ListRow to={`/blog/area/${slug}`} className={page.listRow} tone="blue" icon={icons.notes}>
                  <span className={page.listTitle}>{words.areaNotes}</span>
                </ListRow>
              </li>
            )}
            {repoUrl && !repoInDetails && (
              <li>
                <ListRow href={repoUrl} className={page.listRow} tone="neutral" icon={icons.repo}>
                  <span className={page.listTitle}>{words.repository}</span>
                  <span className={page.listMeta} dir="ltr" translate="no">
                    {repoUrl.replace(/^https:\/\/github\.com\//, "")}
                  </span>
                </ListRow>
              </li>
            )}
            {live && (
              <li>
                <ListRow href={areaFeedUrl(slug)} className={page.listRow} tone="yellow" icon={icons.feed}>
                  <span className={page.listTitle}>{words.feed}</span>
                </ListRow>
              </li>
            )}
          </ul>
        </GroupedSection>
      )}
    </div>
  );
}
