import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, Folder, Globe, Rocket, Upload } from "lucide-react";
import styles from "@/components/dashboard/Dashboard.module.css";
import SkeletonGate from "@/components/gallery/SkeletonGate";
import Ring from "@/components/motion/Ring";
import SkeletonLines from "@/components/gallery/SkeletonLines";
import { fullDate, relative, useWords } from "@/components/dashboard/i18n";
import type { ActivityEvent, ActivityKind } from "@/services/activity";
import { eventTitle } from "@/components/dashboard/eventTitle";

/*
 * "Latest on the site" (#224): the activity API as GitHub's changelog card,
 * a thin rail with a dot per event, the age above the title, and one link
 * onward to the whole log (#226).
 *
 * An event's `href` is a site path for notes and areas and a GitHub URL for
 * repo events, so the first is a router link and the second a plain anchor:
 * a release page is not this site, and the reader should see it leave.
 *
 * Ages are relative ("3 days ago", "לפני 3 ימים") because the card answers
 * "is anything happening", and the exact time is one hover away in `title`
 * and in the `<time>` element's own `dateTime`.
 */

const ICON: Record<ActivityKind, typeof FileText> = {
  post: FileText,
  release: Rocket,
  push: Upload,
  site: Globe,
  area: Folder,
};

export default function Timeline({
  events,
  error,
  onRetry,
  logHref,
  title,
  empty,
}: {
  /** null while loading. */
  events: ActivityEvent[] | null;
  error: string | null;
  onRetry: () => void;
  logHref: string;
  title?: string;
  /** What an empty card says; the site-wide wording by default. */
  empty?: string;
}) {
  const [t, lang] = useWords();
  /* One clock for every age on the card, read once, so two events from the
     same minute never disagree about how long ago it was. */
  const [now] = useState(() => Date.now());
  const id = useId();

  return (
    <section className={styles.timelineCard} aria-labelledby={id} aria-busy={events === null && !error}>
      <h2 id={id} className={styles.timelineTitle}>
        <Ring size={10} />
        {title ?? t.timeline}
      </h2>

      {error ? (
        <div className={styles.inlineError} role="alert">
          <span>{t.eventsFailed}</span>
          <button type="button" className={styles.textButton} onClick={onRetry}>
            {t.retry}
          </button>
        </div>
      ) : events === null ? (
        <SkeletonGate>
          <ol className={styles.timeline}>
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className={styles.event}>
                <span className={styles.eventDot}>
                  <Ring size={20} tone="soft" dot={false} draw={false} />
                </span>
                <span className={styles.eventWhen}>
                  <SkeletonLines lines={1} tail="5rem" />
                </span>
                <span className={styles.eventTitle}>
                  <SkeletonLines lines={2} />
                </span>
              </li>
            ))}
          </ol>
        </SkeletonGate>
      ) : events.length === 0 ? (
        <div className={styles.quiet}>{empty ?? t.noEvents}</div>
      ) : (
        <ol className={styles.timeline}>
          {events.map((e) => {
            const Icon = ICON[e.kind];
            const external = /^https?:\/\//.test(e.href);
            const label = (
              <>
                <span className="sr-only">{`${t.kind[e.kind]}: `}</span>
                {eventTitle(e, t, lang)}
              </>
            );
            return (
              <li key={e.id} className={styles.event} data-kind={e.kind}>
                <span className={styles.eventDot} aria-hidden="true">
                  <Ring size={20} tone="soft">
                    <Icon size={12} strokeWidth={2.25} />
                  </Ring>
                </span>
                <time className={styles.eventWhen} dateTime={e.at} title={fullDate(e.at, lang)}>
                  {relative(e.at, now, lang)}
                </time>
                <span className={styles.eventTitle}>
                  {external ? (
                    <a href={e.href} rel="noopener noreferrer" className={styles.eventLink}>
                      {label}
                    </a>
                  ) : (
                    <Link to={e.href} className={styles.eventLink}>
                      {label}
                    </Link>
                  )}
                </span>
                {e.area && (
                  <span className={styles.eventArea} translate="no">
                    {e.area.title}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <Link to={logHref} className={styles.timelineMore}>
        {t.channelLog}
        <span aria-hidden="true" className={styles.arrow}>
          {" →"}
        </span>
      </Link>
    </section>
  );
}
