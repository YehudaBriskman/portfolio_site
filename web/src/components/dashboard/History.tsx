import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, BookOpen, Check, FileText, FolderGit2, Link2, Rss, Share2 } from "lucide-react";
import styles from "@/components/dashboard/History.module.css";
import dash from "@/components/dashboard/Dashboard.module.css";
import { count, fullDate, relative, shortDate, type Lang } from "@/components/dashboard/i18n";
import { useHistoryWords, type HistoryWords } from "@/components/dashboard/historyWords";
import {
  copyText,
  groupByDay,
  linkedInShareUrl,
  noteId,
  permalink,
  shareLink,
  topicBreakdown,
  wasUpdated,
  xShareUrl,
} from "@/components/dashboard/history";
import { useCopyStatus, useListKeys } from "@/components/dashboard/useHistory";
import SkeletonGate from "@/components/gallery/SkeletonGate";
import SkeletonLines from "@/components/gallery/SkeletonLines";
import Arrive from "@/components/motion/Arrive";
import Ring from "@/components/motion/Ring";
import type { Collection, PostSummary } from "@/services/blog";

/*
 * An area's history (#225): its notes in GitHub's commits look, on the
 * dashboard shell (#224).
 *
 *   Notes on 2 Nov 2026 ─────────────────────────────────────────────
 *   │ Title                                         a1b2c3d  ⧉  ⇪  ↗ │
 *   │ First line of the excerpt…                                     │
 *   │ 2 Nov 2026 · 4 min read · [ci] [infra]   Updated               │
 *
 * Density, ground, colour and depth are the shell's (`Dashboard.module.css`
 * says why). What this adds is one signature, the short id: seven hex digits
 * from the slug, in the code face, where GitHub puts a commit's hash. It
 * does nothing but name the note, so it is a label rather than a button.
 *
 * MOTION: none (`docs/motion-contract.md`, the area history row). A copied
 * link swaps an icon for a tick for two seconds; the share fallback is shown
 * and hidden; `j`/`k` move focus, which scrolls only as far as the browser's
 * own focus does.
 */

/* ─────────────────────────────────────────────────────────────── share */

function ShareButton({ title, url, w }: { title: string; url: string; w: HistoryWords }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !button.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);

  return (
    <span className={styles.shareWrap}>
      <button
        ref={button}
        type="button"
        className={styles.action}
        aria-label={w.shareNote(title)}
        title={w.share}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={async () => {
          if (open) {
            setOpen(false);
            return;
          }
          const how = await shareLink({ url, title });
          if (how === "fallback") setOpen(true);
        }}
      >
        <Share2 aria-hidden="true" />
      </button>
      {open && (
        <div ref={menu} id={menuId} className={styles.shareMenu} data-share-menu="">
          <ul>
            <li>
              <button
                type="button"
                className={styles.shareItem}
                onClick={async () => setCopied(await copyText(url))}
              >
                {copied ? <Check aria-hidden="true" /> : <Link2 aria-hidden="true" />}
                {copied ? w.copied : w.copyLink}
              </button>
            </li>
            <li>
              <a className={styles.shareItem} href={linkedInShareUrl(url)} target="_blank" rel="noopener noreferrer">
                <ArrowUpRight aria-hidden="true" />
                <span translate="no">LinkedIn</span>
                <span className="sr-only">{` (${w.shareOn("LinkedIn")})`}</span>
              </a>
            </li>
            <li>
              <a className={styles.shareItem} href={xShareUrl(url, title)} target="_blank" rel="noopener noreferrer">
                <ArrowUpRight aria-hidden="true" />
                <span translate="no">X</span>
                <span className="sr-only">{` (${w.shareOn("X")})`}</span>
              </a>
            </li>
          </ul>
        </div>
      )}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────── row */

function firstLine(excerpt: string): string {
  const line = excerpt.split(/\n+/)[0]?.trim() ?? "";
  return line;
}

function HistoryRow({
  post,
  lang,
  w,
  origin,
  topicHref,
  copied,
  onCopy,
}: {
  post: PostSummary;
  lang: Lang;
  w: HistoryWords;
  origin: string;
  topicHref: (tag: string) => string;
  copied: boolean;
  onCopy: (key: string, url: string) => void;
}) {
  const id = noteId(post.slug);
  const url = permalink(post.slug, origin);
  const to = `/blog/${post.slug}`;
  const updated = wasUpdated(post);
  const line = firstLine(post.excerpt);
  return (
    <li className={styles.row} data-note-row="">
      <div className={styles.rowBody}>
        {/* Text a person wrote: isolated, so an English title in the Hebrew
            page keeps its punctuation, and the row keeps the page's side. */}
        <Link to={to} className={styles.title} data-row-link="">
          <bdi>{post.title}</bdi>
        </Link>
        {line && (
          <p className={styles.excerpt} dir="auto">
            {line}
          </p>
        )}
        <div className={styles.meta}>
          {post.publishedAt && (
            <time className={dash.metaPart} dateTime={post.publishedAt} title={fullDate(post.publishedAt, lang)}>
              {shortDate(post.publishedAt, lang)}
            </time>
          )}
          <span className={dash.metaPart}>{lang === "he" ? `${post.readingMinutes} דק׳ קריאה` : `${post.readingMinutes} min read`}</span>
          {updated && post.updatedAt && (
            <span className={styles.updated} title={w.updatedOn(fullDate(post.updatedAt, lang))}>
              {w.updated}
              <span className="sr-only">{` ${shortDate(post.updatedAt, lang)}`}</span>
            </span>
          )}
        </div>
        {post.tags.length > 0 && (
          <ul className={dash.chips} aria-label={w.topics}>
            {post.tags.map((tag) => (
              <li key={tag}>
                <Link to={topicHref(tag)} className={dash.chip} translate="no">
                  {tag}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={styles.actions}>
        <code className={styles.id} dir="ltr" translate="no" title={w.noteId}>
          <span className="sr-only">{`${w.noteId} `}</span>
          {id}
        </code>
        <span className={styles.buttons}>
          <button
            type="button"
            className={styles.action}
            aria-label={w.copyLinkTo(post.title)}
            title={w.copyLink}
            onClick={() => onCopy(post.slug, url)}
          >
            {copied ? <Check aria-hidden="true" /> : <Link2 aria-hidden="true" />}
          </button>
          <ShareButton title={post.title} url={url} w={w} />
          <Link to={to} className={styles.action} aria-label={w.openNote(post.title)} title={w.openNote(post.title)} tabIndex={-1}>
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </span>
      </div>
    </li>
  );
}

/* ─────────────────────────────────────────────────────────────── list */

/**
 * The history itself: one card per day, GitHub's "Commits on …" over each.
 * The day is the reader's own calendar day (`Intl`, their time zone).
 */
export function HistoryList({
  posts,
  topicHref,
  timeZone,
}: {
  posts: PostSummary[];
  topicHref: (tag: string) => string;
  timeZone?: string;
}) {
  const [w, lang] = useHistoryWords();
  const list = useRef<HTMLDivElement>(null);
  useListKeys(list);
  const { copied, message, copy } = useCopyStatus();
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const groups = groupByDay(posts, timeZone);

  return (
    <div ref={list} className={styles.history} aria-label={w.historyLabel} role="region">
      {groups.map((g) => {
        const heading = g.at ? w.notesOn(shortDate(g.at, lang)) : w.undated;
        return (
          <Arrive as="section" key={g.day || "undated"} className={styles.day} aria-label={heading}>
            <h3 className={styles.dayHead}>
              {/* The day's circle bullet (#251), drawn round the kind as
                  the day comes up. */}
              <Ring size={20} tone="soft">
                <FileText />
              </Ring>
              {heading}
            </h3>
            <ul className={styles.rows}>
              {g.items.map((p) => (
                <HistoryRow
                  key={p.slug}
                  post={p}
                  lang={lang}
                  w={w}
                  origin={origin}
                  topicHref={topicHref}
                  copied={copied === p.slug}
                  onCopy={(key, url) => void copy(key, url, w.copied, w.copyFailed)}
                />
              ))}
            </ul>
          </Arrive>
        );
      })}
      <p className="sr-only" role="status">
        {message}
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── repo facts */

/* GitHub's own language colours for the few this site's repos are written
   in; anything else gets the soft ink, which is honest about not knowing. */
const LANGUAGE_COLOUR: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572a5",
  Go: "#00add8",
  Rust: "#dea584",
  Shell: "#89e051",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Java: "#b07219",
  "C#": "#178600",
  "C++": "#f34b7d",
  Dockerfile: "#384d54",
};

type Stats = NonNullable<Collection["stats"]>;

/**
 * What GitHub says about the repo, from the stored stats and never fetched
 * live. Every fact is as old as the scheduled read, so each one carries that
 * time (as its `title`, and through `aria-describedby` to the one line that
 * says it out loud) rather than the same sentence six times.
 */
export function RepoFacts({ stats, repoUrl }: { stats: Stats; repoUrl: string | null }) {
  const [w, lang] = useHistoryWords();
  const [now] = useState(() => Date.now());
  const asOfId = useId();
  const asOf = stats.fetchedAt ? w.asOf(fullDate(stats.fetchedAt, lang)) : w.factsNoTime;
  const fact = (key: string, label: string, value: ReactNode) => (
    <div key={key} className={styles.fact} title={`${label}, ${asOf}`}>
      <dt className={styles.factLabel}>{label}</dt>
      <dd className={styles.factValue} aria-describedby={asOfId}>
        {value}
      </dd>
    </div>
  );
  const facts: ReactNode[] = [];
  if (stats.language) {
    facts.push(
      fact(
        "lang",
        w.language,
        <>
          <span
            className={styles.langDot}
            aria-hidden="true"
            style={{ background: LANGUAGE_COLOUR[stats.language] ?? "rgb(var(--ink-soft))" }}
          />
          <span translate="no">{stats.language}</span>
        </>,
      ),
    );
  }
  if (stats.stars !== null) facts.push(fact("stars", w.stars, <span className={styles.num}>{count(stats.stars, lang)}</span>));
  if (stats.forks != null) facts.push(fact("forks", w.forks, <span className={styles.num}>{count(stats.forks, lang)}</span>));
  if (stats.latestRelease) {
    const r = stats.latestRelease;
    facts.push(
      fact(
        "release",
        w.release,
        <>
          <a href={r.url} className={styles.factLink} dir="ltr" translate="no">
            {r.tag}
          </a>
          {r.publishedAt && (
            <time className={styles.factWhen} dateTime={r.publishedAt} title={fullDate(r.publishedAt, lang)}>
              {relative(r.publishedAt, now, lang)}
            </time>
          )}
        </>,
      ),
    );
  }
  if (stats.pushedAt) {
    facts.push(
      fact(
        "pushed",
        w.pushed,
        <time dateTime={stats.pushedAt} title={fullDate(stats.pushedAt, lang)}>
          {relative(stats.pushedAt, now, lang)}
        </time>,
      ),
    );
  }
  if (stats.license) facts.push(fact("licence", w.licence, <span translate="no">{stats.license}</span>));
  if (facts.length === 0) return null;
  return (
    <div className={styles.facts}>
      <dl className={styles.factList}>{facts}</dl>
      <p id={asOfId} className={styles.asOf}>
        {stats.fetchedAt ? (
          <>
            {repoUrl ? <span className="sr-only">{`${w.repo}: `}</span> : null}
            <time dateTime={stats.fetchedAt}>{w.factsAsOf(fullDate(stats.fetchedAt, lang))}</time>
          </>
        ) : (
          w.factsNoTime
        )}
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── side card */

const SHARE_HUES = ["--hue-blue", "--hue-green", "--hue-yellow", "--hue-purple"];

/**
 * The topic breakdown, GitHub's language bar made round (#251): one ring, an
 * arc per topic in the brand hues the area marks use, and a legend that is
 * the real list (each entry a filter link, with its count and share). The
 * ring is decoration over the legend, so it is hidden from assistive tech.
 */
export function TopicBar({
  posts,
  topicHref,
  current,
}: {
  posts: PostSummary[];
  topicHref: (tag: string) => string;
  current: string | null;
}) {
  const [w, lang] = useHistoryWords();
  const { shares, other, total } = topicBreakdown(posts);
  if (total === 0) return <p className={dash.quiet}>{w.noTopics}</p>;
  const pct = new Intl.NumberFormat(lang === "he" ? "he-IL" : "en-GB", { style: "percent", maximumFractionDigits: 0 });
  const parts = [
    ...shares.map((s, i) => ({ key: s.tag, label: s.tag, count: s.count, hue: SHARE_HUES[i % SHARE_HUES.length], tag: s.tag })),
    ...(other > 0 ? [{ key: "__other", label: w.other, count: other, hue: null, tag: null }] : []),
  ];
  /* The shares as a ring (#251) rather than GitHub's strip: the circle is
     the site's motif. r = 100/2π, so a share's dash length is its percent;
     each arc gives up 1.5 of its length as the gap before the next. */
  const GAP = parts.length > 1 ? 1.5 : 0;
  let at = 0;
  const arcs = parts.map((p) => {
    const len = (p.count / total) * 100;
    const arc = { ...p, from: at, len: Math.max(0.5, len - GAP) };
    at += len;
    return arc;
  });
  return (
    <div className={styles.topics}>
      <svg className={styles.ring} viewBox="0 0 36 36" aria-hidden="true" focusable="false">
        <circle className={styles.ringTrack} cx="18" cy="18" r="15.9155" />
        {arcs.map((a) => (
          <circle
            key={a.key}
            className={styles.ringArc}
            cx="18"
            cy="18"
            r="15.9155"
            style={{
              stroke: a.hue ? `rgb(var(${a.hue}))` : "rgb(var(--ink-soft) / 0.5)",
              strokeDasharray: `${a.len} ${100 - a.len}`,
              strokeDashoffset: 25 - a.from,
            }}
          />
        ))}
      </svg>
      <ul className={styles.legend}>
        {parts.map((p) => {
          const label = w.topicShare(p.label, p.count, pct.format(p.count / total));
          const dot = (
            <span
              className={styles.legendDot}
              aria-hidden="true"
              style={{ background: p.hue ? `rgb(var(${p.hue}))` : "rgb(var(--ink-soft) / 0.5)" }}
            />
          );
          const body = (
            <>
              {dot}
              <span className={styles.legendLabel} translate={p.tag ? "no" : undefined}>
                {p.label}
              </span>
              <span className={styles.legendPct} aria-hidden="true">
                {pct.format(p.count / total)}
              </span>
              <span className="sr-only">{label}</span>
            </>
          );
          return (
            <li key={p.key}>
              {p.tag ? (
                <Link
                  to={topicHref(p.tag)}
                  className={styles.legendItem}
                  aria-current={current === p.tag ? "true" : undefined}
                >
                  {body}
                </Link>
              ) : (
                <span className={styles.legendItem}>{body}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The aside: the way out to the project, the repo, the feed and the docs. */
export function AreaSideCard({
  area,
  slug,
  feedUrl,
  children,
}: {
  area: Collection | null;
  slug: string;
  feedUrl: string;
  children: ReactNode;
}) {
  const [w] = useHistoryWords();
  const headingId = useId();
  const docsId = useId();
  const topicsId = useId();
  return (
    <div className={styles.side}>
      <section className={styles.sideCard} aria-labelledby={headingId}>
        <h2 id={headingId} className={styles.sideTitle}>
          <Ring size={10} />
          {w.aboutArea}
        </h2>
        <ul className={styles.sideLinks}>
          {area?.kind === "project" && (
            <li>
              <Link to={`/projects/${slug}`} className={styles.sideLink} data-primary="">
                <FolderGit2 aria-hidden="true" />
                {w.goToProject}
              </Link>
            </li>
          )}
          {area?.repoUrl && (
            <li>
              <a href={area.repoUrl} className={styles.sideLink}>
                <ArrowUpRight aria-hidden="true" />
                {w.viewRepo}
                <span className={styles.sideUrl} dir="ltr" translate="no">
                  {area.repoUrl.replace(/^https:\/\/github\.com\//, "")}
                </span>
              </a>
            </li>
          )}
          <li>
            <a href={feedUrl} className={styles.sideLink} type="application/rss+xml">
              <Rss aria-hidden="true" />
              {w.rss}
            </a>
          </li>
        </ul>
      </section>

      {area?.docs && area.docs.length > 0 && (
        <section className={styles.sideCard} aria-labelledby={docsId}>
          <h2 id={docsId} className={styles.sideTitle}>
            <Ring size={10} />
            {w.docs}
          </h2>
          <ul className={styles.sideLinks}>
            {area.docs.map((d) => (
              <li key={d.path}>
                <a href={d.url} className={styles.sideLink}>
                  <BookOpen aria-hidden="true" />
                  <span className={styles.docPath} dir="ltr" translate="no">
                    {d.path}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.sideCard} aria-labelledby={topicsId}>
        <h2 id={topicsId} className={styles.sideTitle}>
          <Ring size={10} />
          {w.topics}
        </h2>
        {children}
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── skeleton */

/** A day head and rows in the rows' own shape, so nothing moves on arrival. */
export function HistorySkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <SkeletonGate>
      <div className={styles.day}>
        <div className={styles.dayHead}>
          <span className={dash.skLines}>
            <SkeletonLines lines={1} tail="9rem" />
          </span>
        </div>
        <div className={styles.rows}>
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className={styles.row}>
              <span className={styles.rowBody}>
                <span className={dash.skLines}>
                  <SkeletonLines lines={1} tail={i % 2 ? "62%" : "78%"} />
                </span>
                <span className={dash.skMeta}>
                  <SkeletonLines lines={1} tail="85%" />
                </span>
                <span className={dash.skMeta}>
                  <SkeletonLines lines={1} tail="11rem" />
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </SkeletonGate>
  );
}
