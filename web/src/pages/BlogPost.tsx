import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ListTree, Pencil } from "lucide-react";
import { heldHeight, useRememberHeight } from "@/lib/heldHeight";
import PageShell from "@/components/PageShell";
import Ridge from "@/components/Ridge";
import Byline, { FeedLink } from "@/components/notes/Byline";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import MetaPill from "@/components/notes/MetaPill";
/* The two corrections that make `.note-card` and the small capsules read
   as surfaces on paper rather than on the near-black ground they were
   drawn for. See NoteCard.module.css and Pill.module.css. */
import card from "@/components/notes/NoteCard.module.css";
import pill from "@/components/notes/Pill.module.css";
import PostFooterNav from "@/components/notes/PostFooterNav";
import ReadingBar from "@/components/notes/ReadingBar";
import TagPill from "@/components/notes/TagPill";
import { blog, type Post, type PostSummary } from "@/services/blog";
import { shortDate } from "@/components/dashboard/i18n";
import NoteMarkdown from "@/components/notes/reader/NoteMarkdown";
import NotePanels from "@/components/notes/reader/NotePanels";
import { useActiveHeading, useHeadings } from "@/components/notes/reader/Toc";
import { useIsAdmin } from "@/components/notes/reader/adminSession";
import { prefsVars, useReadingPrefs } from "@/components/notes/reader/readingPrefs";
import { useReaderWords } from "@/components/notes/reader/words";
import { useNotesWords } from "@/i18n/pages";
import { hasHebrew, inEnglish } from "@/i18n/words";
import Arrow from "@/i18n/Arrow";
import reader from "@/components/notes/reader/Reader.module.css";

/*
 * A note, in reader mode (#249).
 *
 * The body is drawn by `notes/reader/NoteMarkdown`, the one renderer the
 * editor's preview shares (it carries the reasons the element overrides had
 * here: no rehype-raw, lazy pictures, the full-width blocks, the pen). This
 * page adds what Bothy's reader has around a document: a sticky aside on a
 * wide screen with the outline tracking the heading being read, the note's
 * facts and the reading tools, collapsing to a sheet (a native modal
 * <dialog>) on a phone; and "Edit" for the signed-in admin only.
 *
 * The pen (`motion/Written`) needs nothing from any of it. The aside is not
 * prose, so nothing in it is written; a change of text size or line length
 * changes the document's height, which the pen's own ResizeObserver on the
 * root already re-measures; and the outline's jumps are ordinary fragment
 * scrolls, after which the pen is wherever the scroll put it.
 */
export default function BlogPost() {
  const { slug = "" } = useParams();
  const [post, setPost] = useState<Post | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [collectionTitle, setCollectionTitle] = useState<string | null>(null);
  const [neighbours, setNeighbours] = useState<{ newer: PostSummary | null; older: PostSummary | null }>({
    newer: null,
    older: null,
  });

  /*
   * The reading matter, and nothing after it. The tags, the link list, the
   * prev/next pair and the site footer are all outside this box on purpose:
   * they are what made a document-wide progress bar read 70% at the end of
   * the article. See ReadingBar.
   */
  const reading = useRef<HTMLDivElement>(null);
  const [w, lang] = useReaderWords();
  const notesWords = useNotesWords();
  const [prefs, setPrefs] = useReadingPrefs();
  const isAdmin = useIsAdmin();
  const sheet = useRef<HTMLDialogElement>(null);
  const sheetOpener = useRef<HTMLElement | null>(null);
  const sheetTitle = useId();
  const openSheet = (from: HTMLElement) => {
    sheetOpener.current = from;
    sheet.current?.showModal?.();
  };

  useRememberHeight(`post:${slug}`, state === "ok");

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  /* Another slug, or a retry, starts from nothing in the render that asks for
     it — not an effect later, which painted the old post for one frame. */
  const [shownFor, setShownFor] = useState({ slug, attempt });
  if (shownFor.slug !== slug || shownFor.attempt !== attempt) {
    setShownFor({ slug, attempt });
    setState("loading");
    setPost(null);
    setCollectionTitle(null);
    setNeighbours({ newer: null, older: null });
  }

  useEffect(() => {
    let alive = true;
    blog
      .post(slug)
      .then((p) => {
        if (!alive) return;
        setPost(p);
        setState("ok");
      })
      .catch((e) => {
        if (!alive) return;
        setState(e instanceof Error && e.message === "not-found" ? "missing" : "error");
      });
    return () => {
      alive = false;
    };
  }, [slug, attempt]);

  /*
   * The tab title, once the post has a name.
   *
   * This was two lines inside the fetch above and one in its cleanup, and the
   * cleanup was the problem: it restored the home page's title on unmount, so
   * leaving a post set the title back to "Yehuda Briskman · Full-stack
   * engineer & team lead" — which is to say, every page reached *from* a post
   * inherited the home page's title, which is the bug a per-route title exists
   * to fix. `RouteAnnouncer` writes a title on every route change from the path
   * alone, so there is nothing to restore and no window in which the title is
   * stale; all this has to do is improve on the path's guess once the real name
   * lands.
   *
   * "Not found" on a missing slug rather than the humanised slug the resolver
   * guessed, and the same string `seo.route.ts` puts in the head for exactly
   * these addresses: a post that is unpublished or gone is a 404 wearing a
   * note's URL, and titling it after the note implies it exists.
   */
  useDocumentTitle(state === "missing" ? "Not found" : (post?.title ?? null));

  useEffect(() => {
    if (!post) return;
    let alive = true;
    // Neighbours come out of the listing the collection page already uses, so
    // this needs no new endpoint. They are a convenience: if the request fails
    // the post simply has no next and previous, which is not worth reporting.
    blog
      .posts({ collection: post.collection })
      .then((list) => {
        if (!alive) return;
        const i = list.findIndex((p) => p.slug === post.slug);
        if (i < 0) return;
        setNeighbours({ newer: list[i - 1] ?? null, older: list[i + 1] ?? null });
      })
      .catch(() => undefined);
    if (post.collection !== "site") {
      blog
        .collection(post.collection)
        .then((c) => alive && setCollectionTitle(c.title))
        .catch(() => undefined);
    }
    return () => {
      alive = false;
    };
  }, [post]);

  /* The outline is read from the rendered body; keyed on the post so a new
     note starts a new read. */
  const headings = useHeadings(reading, `${slug}:${state}`);
  const active = useActiveHeading(headings);

  return (
    <PageShell>
      {post && state === "ok" && (
        <ReadingBar title={post.title} target={reading} contentsLabel={w.contents} onContents={openSheet} />
      )}

      {/*
        Not `.wrap`: 46rem is the reading measure, which is narrower than the
        site's layout measure on purpose — the title and the cover run the
        full article width while the prose inside holds to 38rem, and that
        difference is the page's hierarchy. The gutter and the section rhythm
        are the system's, though.
      */}
      {/* While loading, the box is a screen tall: the placeholder is far shorter
          than a note, so the footer used to sit under it and be shoved down the
          moment the note arrived (CLS 0.78 at 390). A screen of reserved height
          keeps the footer out of view until there is a note above it. */}
      <div className={`section-y px-gutter ${state === "ok" || state === "loading" ? reader.layout : "mx-auto w-full max-w-[46rem]"} `} style={state === "loading" ? { minHeight: heldHeight(`post:${slug}`) } : undefined}>
      <article data-crest data-hue="150 82 64" className="min-w-0" style={prefsVars(prefs) as React.CSSProperties}>
        {state === "loading" && (
          /* Shaped like the real header rather than announced as a word, so the
             title and the cover do not jump into place over a line of text. */
          <div aria-busy="true" aria-live="polite">
            <span className="sr-only">{w.loading}</span>
            {/* The real header sits under a `mt-12` and opens on a 44px pill;
                the placeholder starts at the same line, in the same column
                (the layout, aside and all), so nothing moves when it is replaced. */}
            <div aria-hidden="true" className="mt-12 space-y-5">
              <div className="h-11 w-28 scrub-pulse rounded-full bg-surface" />
              <div className="h-12 w-full scrub-pulse rounded-full bg-surface sm:h-16" />
              <div className="h-12 w-3/4 scrub-pulse rounded-full bg-surface sm:h-16" />
              <div className="h-5 w-1/2 scrub-pulse rounded-full bg-surface" />
              <div className="aspect-[16/9] w-full scrub-pulse rounded-[var(--r-xl)] bg-surface" />
            </div>
          </div>
        )}

        {state === "missing" && (
          <div>
            <h1 className="display text-section">{w.notHere}</h1>
            <p className="mt-6 max-w-[34rem] text-[1.0625rem] leading-[1.7] text-bone/85">{w.notHereBody}</p>
            <Link to="/blog" className="btn btn-quiet mt-12">
              <span aria-hidden="true" className={reader.flipRtl}>&larr;</span> {w.back}
            </Link>
          </div>
        )}

        {state === "error" && (
          /*
           * The backend lives on one machine, so this is a screen a real
           * visitor meets, not a theoretical branch. It says which half failed,
           * offers the one action that can fix it, and leaves two ways onward
           * that do not need the API at all.
           */
          <div className={`note-card ${card.card} px-6 py-12 sm:px-10 sm:py-16`}>
            <p className="eyebrow">{w.unavailable}</p>
            <h1 className="display-tight mt-3 text-[clamp(1.75rem,6vw,2.5rem)]">{w.noAnswer}</h1>
            <p className="mt-6 max-w-[34rem] text-[1.0625rem] leading-[1.7] text-bone/85">{w.noAnswerBody}</p>
            <div className="mt-12 flex flex-wrap gap-3">
              <button type="button" onClick={retry} className="btn btn-solid">
                {w.tryAgain}
              </button>
              <Link to="/blog" className="btn btn-quiet">
                {w.back}
              </Link>
              <Link to="/projects" className="btn btn-quiet">
                {w.work}
              </Link>
            </div>
          </div>
        )}

        {post && state === "ok" && (() => {
          /* A Hebrew page over a body with no Hebrew of its own: the body is
             marked as the English it is, and says so above the title (#248). */
          const bodyInEnglish = lang === "he" && !hasHebrew(post.body);
          return (
          <>
            <div ref={reading}>
              <header className="isolate relative">
                {/* On a phone the back affordance lives in the bar at the foot of
                    the screen, where it is still reachable three thousand pixels
                    into the article. */}
                <Link
                  to="/blog"
                  className={`mono ${pill.tag} hidden min-h-[44px] items-center gap-2 rounded-full border px-4 py-2 text-xs uppercase tracking-[0.16em] transition-colors duration-150 sm:inline-flex`}
                >
                  <span aria-hidden="true" className={reader.flipRtl}>&larr;</span> {w.back}
                </Link>

                <div className="mt-12">
                  {collectionTitle ? (
                    <Link
                      to={`/projects/${post.collection}`}
                      className={`tap mono ${pill.tag} inline-flex min-h-[44px] items-center gap-2 rounded-full border px-3.5 py-2 text-xs uppercase tracking-[0.18em] transition-colors duration-150`}
                    >
                      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-clay" />
                      {/* This one goes to the project; the "Area" link beside
                          the post goes to the notes filed under it. Said so. */}
                      <span>{w.project}:</span>
                      {collectionTitle}
                    </Link>
                  ) : post.collection ? (
                    /* The collection's title arrives from a second request. Until it
                       does, hold the 44px the pill will take, or the title below
                       drops by the difference. */
                    <div className="flex min-h-[44px] items-center">
                      <p className="eyebrow">{w.note}</p>
                    </div>
                  ) : (
                    <p className="eyebrow">{w.note}</p>
                  )}
                  {bodyInEnglish && (
                    <p className="eyebrow mt-3" data-written-in="en">
                      {notesWords.writtenInEnglish}
                    </p>
                  )}
                </div>

                <h1 className="display mt-3 text-[clamp(2.1rem,8.5vw,3.75rem)] leading-[0.96]" {...inEnglish(lang, post.title)}>
                  {post.title}
                </h1>

                {/* The second voice, under the display line — the one thing
                    on a post between a 12px label and the title. In the sans
                    at 18-20px it was simply the first paragraph set slightly
                    large, which is the register this page has deliberately
                    emptied out. */}
                {post.subtitle && (
                  <p className="editorial mt-6 max-w-[30rem] text-[1.375rem] text-bone sm:text-[1.75rem]" {...inEnglish(lang, post.subtitle)}>
                    {post.subtitle}
                  </p>
                )}

                {/* A name and a face, which a personal blog had nowhere above
                    the fold, beside the two facts that were already here. */}
                <Byline
                  className="mt-12 border-t border-edge pt-6"
                  meta={
                    <div className="flex flex-wrap items-center">
                      {post.publishedAt && (
                        <MetaPill>
                          <time dateTime={post.publishedAt}>{shortDate(post.publishedAt, lang)}</time>
                        </MetaPill>
                      )}
                      <MetaPill>{w.readTime(post.readingMinutes)}</MetaPill>
                    </div>
                  }
                />
                {/* Below the wide layout the panels live in a sheet; this is
                    its opener at the top of the note (the reading bar at the
                    foot of a phone's screen carries another). Edit sits
                    beside it, for the signed-in admin only. */}
                <div className={`${reader.phoneBar} ${reader.phoneOnly} flex flex-wrap gap-2`}>
                  <button
                    type="button"
                    className={reader.panelBtn}
                    aria-haspopup="dialog"
                    onClick={(e) => openSheet(e.currentTarget)}
                  >
                    <ListTree size={15} aria-hidden="true" /> {w.contentsAndDetails}
                  </button>
                  {isAdmin && (
                    <Link to={`/admin/posts/${post.slug}`} className={reader.panelBtn} aria-label={w.editNote}>
                      <Pencil size={15} aria-hidden="true" /> {w.edit}
                    </Link>
                  )}
                </div>
              </header>

              {post.coverImage && (
                <img
                  src={post.coverImage}
                  alt=""
                  width={1600}
                  height={900}
                  /* The largest element above the fold on this page, and it had no
                     dimensions at all, so every post loaded with a layout shift. */
                  fetchpriority="high"
                  decoding="async"
                  className="bleed mt-12 aspect-[16/9] w-full border-y border-edge object-cover sm:rounded-[var(--r-xl)] sm:border"
                />
              )}

              {bodyInEnglish ? (
                <div lang="en" dir="ltr">
                  <NoteMarkdown body={post.body} />
                </div>
              ) : (
                <NoteMarkdown body={post.body} />
              )}
            </div>

            {post.tags.length > 0 && (
              <ul className="mt-section-sm flex flex-wrap gap-2">
                {post.tags.map((t) => (
                  <li key={t}>
                    <TagPill tag={t} />
                  </li>
                ))}
              </ul>
            )}

            {post.links.length > 0 && (
              <ul className="mt-6 flex flex-wrap gap-3">
                {post.links.map((l) => (
                  /* `min-w-0 max-w-full`, and a label that may wrap: a long link
                     label ("PR #329, ...") was a single unbreakable pill wider
                     than a phone, so it ran out of the frame. */
                  <li key={l.url} className="min-w-0 max-w-full">
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="btn btn-quiet h-auto max-w-full whitespace-normal py-3 text-start [overflow-wrap:anywhere]"
                    >
                      <span className="min-w-0">{l.label}</span>{" "}
                      <span aria-hidden="true" className="shrink-0"><Arrow to="out" /></span>
                    </a>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-12 flex flex-wrap items-center justify-between gap-6 border-t border-edge pt-6">
              <Byline />
              <FeedLink />
            </div>

            <div className="mt-section-sm opacity-70">
              <Ridge variant={2} />
            </div>

            <PostFooterNav newer={neighbours.newer} older={neighbours.older} />
          </>
          );
        })()}
      </article>

      {post && state === "ok" && (
        <aside className={reader.aside} aria-label={w.contentsAndDetails}>
          <div className={reader.asideInner}>
            <NotePanels
              post={post}
              areaTitle={collectionTitle}
              headings={headings}
              active={active}
              prefs={prefs}
              setPrefs={setPrefs}
              isAdmin={isAdmin}
            />
          </div>
        </aside>
      )}
      </div>

      {post && state === "ok" && (
        <dialog
          ref={sheet}
          className={`${reader.sheet} pop-dialog pop-dialog--bottom`}
          aria-labelledby={sheetTitle}
          onClose={() => sheetOpener.current?.focus()}
          onClick={(e) => {
            /* A press on the backdrop is a press on the dialog itself. */
            if (e.target === e.currentTarget) sheet.current?.close();
          }}
        >
          <div className={reader.sheetHead}>
            <h2 id={sheetTitle} className={reader.sheetTitle}>
              {w.contentsAndDetails}
            </h2>
            <button type="button" className={reader.toolBtn} onClick={() => sheet.current?.close()} aria-label={w.close}>
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
          <div className={reader.sheetBody}>
            <NotePanels
              post={post}
              areaTitle={collectionTitle}
              headings={headings}
              active={active}
              prefs={prefs}
              setPrefs={setPrefs}
              isAdmin={isAdmin}
              onPick={() => sheet.current?.close()}
            />
          </div>
        </dialog>
      )}
    </PageShell>
  );
}
