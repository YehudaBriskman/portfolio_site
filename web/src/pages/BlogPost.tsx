import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import PageShell from "@/components/PageShell";
import Ridge from "@/components/Ridge";
import Byline, { FeedLink } from "@/components/notes/Byline";
import { useCodeHighlight } from "@/components/notes/CodeHighlight";
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
import { blog, formatDate, type Post, type PostSummary } from "@/services/blog";

/*
 * Full-width blocks inside the reading column.
 *
 * The article's content box is 46rem wide; the prose inside it is held to
 * 38rem for the measure. That left every figure, code block and table inset by
 * 40px relative to the cover and the title directly above them, which does not
 * read as a narrower measure — it reads as a misalignment bug.
 *
 * The number is not hard-coded, because it changes with the viewport: the
 * wrapper around the prose declares itself a query container, so `100cqw` is
 * literally the article's content width and the negative margin is exactly the
 * difference between that and the column. Where they are equal — anywhere the
 * viewport is too narrow for the full measure — it resolves to zero on its
 * own. Below `sm` the existing `.bleed` rule takes over and runs these blocks
 * to the screen edges instead.
 */
const FULL_WIDTH = "bleed bleed-column";

/* A break inside a post is the same kind of break as one between the home
   page's sections, so it gets the same silhouette rather than a grey line. */
function MarkdownRule() {
  return (
    <div className={`not-prose ${FULL_WIDTH} my-12 h-6 opacity-70`} aria-hidden="true">
      <svg viewBox="0 0 1440 64" preserveAspectRatio="none" className="h-full w-full" role="presentation">
        <path
          d="M0,40 C120,52 240,30 360,38 C500,47 604,26 728,32 C868,39 1010,24 1160,36 C1290,46 1380,34 1440,42 L1440,64 L0,64 Z"
          fill="rgb(var(--edge) / 0.55)"
        />
      </svg>
    </div>
  );
}

/*
 * Element overrides for the article body.
 *
 * There is no rehype-raw here and there never will be — without it react-markdown
 * refuses to render raw HTML, which removes the entire stored-content XSS
 * surface. That makes this object the only injection point the renderer has, so
 * everything the plugin's defaults get wrong is corrected here:
 *
 *  - react-markdown emits a bare <img>, so every image in every post loaded
 *    eagerly and shifted the layout as it arrived.
 *  - a code block or a GFM table inside a 350px phone column shows nothing
 *    useful, so both break out to the full screen width and scroll themselves.
 *  - an outbound link had neither target nor rel and no visible sign it left
 *    the site.
 *  - every heading rendered in a bare `font-[Archivo]` with no fallback stack
 *    and none of the width-axis setting the rest of the site's display type
 *    carries, so an article's headings were the one place on the site where
 *    Archivo was set differently. They borrow `.display-tight` now, which is
 *    the same rule the cards and the section headings already use.
 *
 * Defined at module scope so the object identity is stable across renders.
 */
const markdown: Components = {
  h1: ({ children }) => <h1 className="display-tight">{children}</h1>,
  h2: ({ children }) => <h2 className="display-tight">{children}</h2>,
  h3: ({ children }) => <h3 className="display-tight">{children}</h3>,
  h4: ({ children }) => <h4 className="display-tight">{children}</h4>,
  h5: ({ children }) => <h5 className="display-tight">{children}</h5>,
  h6: ({ children }) => <h6 className="display-tight">{children}</h6>,

  a({ href, children }) {
    const isAbsolute = typeof href === "string" && /^https?:\/\//i.test(href);
    const external =
      isAbsolute && !(typeof window !== "undefined" && href.startsWith(window.location.origin));
    if (!external) return <a href={href}>{children}</a>;
    return (
      <a href={href} target="_blank" rel="noreferrer noopener">
        {children}
        <span aria-hidden="true" className="ml-0.5 no-underline">
          &#8599;
        </span>
      </a>
    );
  },

  img({ src, alt, title }) {
    return (
      <span className={`not-prose ${FULL_WIDTH} my-9 block`}>
        <img
          src={src}
          alt={alt ?? ""}
          loading="lazy"
          decoding="async"
          className="block w-full border-y border-edge sm:rounded-[var(--r-lg)] sm:border"
        />
        {title && (
          <span className="mono mt-3 block text-center text-[0.75rem] tracking-[0.06em] text-clay">
            {title}
          </span>
        )}
      </span>
    );
  },

  /*
   * Darker than a panel, not lighter: a code block is a well the page is cut
   * into, which is also what stops it competing with the cards elsewhere.
   *
   * `className` and `style` are taken from the node rather than dropped,
   * because when the highlighter has loaded they are how Shiki hands over the
   * theme's ground and default ink. Before it loads — and forever, if it never
   * does — neither is present and the Tailwind classes below stand alone, so
   * the block is always at least readable plain text.
   */
  pre({ children, className = "", style }) {
    return (
      <pre
        style={style}
        /* Focusable because it scrolls: a keyboard-only reader has no other
           way to reach the right-hand end of a long line. */
        tabIndex={0}
        className={`not-prose ${FULL_WIDTH} my-9 overflow-x-auto border-y border-edge bg-bitumen px-5 py-4 font-mono text-[0.8125rem] leading-[1.65] text-bone/90 [scrollbar-width:thin] sm:rounded-[var(--r-lg)] sm:border sm:text-[0.875rem] ${className}`}
      >
        {children}
      </pre>
    );
  },

  table({ children }) {
    return (
      <div className={`not-prose ${FULL_WIDTH} my-9 overflow-x-auto px-5 [scrollbar-width:thin] sm:px-0`}>
        <table className="w-full min-w-[30rem] border-collapse text-left">{children}</table>
      </div>
    );
  },
  th({ children }) {
    return (
      <th className="mono border-b border-edge pb-3 pr-6 text-xs uppercase tracking-[0.18em] text-clay">
        {children}
      </th>
    );
  },
  /* No font-size of its own. A cell is body copy in a grid, and sizing it
     separately was the fourth text size inside a single article. */
  td({ children }) {
    return (
      <td className="border-b border-edge py-3 pr-6 align-top leading-[1.6] text-bone/85">
        {children}
      </td>
    );
  },

  hr: MarkdownRule,
};

/*
 * The reading column.
 *
 * The measure was 768px at 17px — about 95 characters, half again the length a
 * line should run. The body is held to 38rem (~66 characters at the desktop
 * size) while the title, the cover and the footer keep the full 46rem: the
 * title being wider than the prose is what gives the page its hierarchy.
 *
 * Body copy is bone/85 (8.9:1) rather than the bone/75 it was, and links carry
 * an underline rather than colour alone. That rule was written when the accent
 * was still here and measured 1.30:1 against the surrounding text — far under
 * the 3:1 that lets colour mark a link on its own — and with the accent
 * retired the underline is not a reinforcement any more, it is the entire
 * signal. Which is why it is on at rest and thickens on hover rather than
 * appearing there.
 *
 * One body size, set here and inherited
 * -------------------------------------
 * This used to run four sizes at once: paragraphs at 19px, list items at 16px,
 * blockquotes at 17px — a pull quote smaller than the body it was pulled out
 * of — and table cells at 15px. Nothing about a list makes it less important
 * than the paragraph introducing it. The size now lives on the root and p, li,
 * blockquote and td all inherit it, so there is exactly one body size in an
 * article and the only deliberate steps away from it are upward (headings) or
 * into another voice entirely (mono captions and column labels).
 *
 * Every heading is also at least as large as the body, which `h4` at 17px and
 * `h5`/`h6` at nothing at all previously were not.
 */
/*
 * Why there is no colour inside the article.
 *
 * The rule the rest of the site runs on is that a surface takes its wash from
 * its position in a group — five hues, cycling, keyed off `nth-child` (see
 * cards/PaperCard.module.css). A pull quote, a code block and a table are not
 * in a group. They are one of a kind, in an arbitrary order, decided by
 * whoever wrote the post; there is no position for the rule to read, and
 * picking a hue for them by hand is the lottery the rule exists to avoid.
 *
 * So the blocks in here take the shape of the change and not the colour: the
 * card's 32px corner, a fill of white rather than a grey mixed for a dark
 * ground, and a border in --rule-firm so the edge is visible at all. The
 * colour on this page is where the rule can reach it — the collection chip,
 * the tags, and the two neighbouring notes at the foot, which really are a
 * group of two.
 */
const PROSE = [
  "prose prose-invert mx-auto mt-section-sm max-w-[38rem]",
  "text-[1.0625rem] leading-[1.7] text-bone/85 sm:text-[1.1875rem] sm:leading-[1.75]",

  // Space above a heading is ~2.5x the space below it. The plugin's default is
  // nearer 2:1, which is what made every section run into the one before it.
  // Colour is set per level rather than through `prose-headings:` so that the
  // two quiet levels do not have to out-specify a rule that covers all six.
  "prose-h1:mt-14 prose-h1:mb-4 prose-h1:text-[1.9rem] prose-h1:leading-[1.05] prose-h1:text-bone sm:prose-h1:text-[2.35rem]",
  "prose-h2:mt-14 prose-h2:mb-4 prose-h2:text-[1.6rem] prose-h2:leading-[1.1] prose-h2:text-bone sm:prose-h2:text-[2rem]",
  "prose-h3:mt-10 prose-h3:mb-3 prose-h3:text-[1.3rem] prose-h3:leading-[1.2] prose-h3:text-bone sm:prose-h3:text-[1.5rem]",
  "prose-h4:mt-8 prose-h4:mb-2 prose-h4:text-[1.1875rem] prose-h4:leading-[1.3] prose-h4:text-bone sm:prose-h4:text-[1.3125rem]",
  /*
   * The last two levels step down in voice, not in size — a heading set
   * smaller than the paragraph under it is not a heading. That used to mean
   * the accent for h5 and tracked clay capitals for h6, and with the accent
   * gone h5 takes the serif italic instead: the site's own second voice,
   * which is a larger step away from the sans than any colour was, and the
   * same move the hero's tagline and a project's make one level up.
   */
  "prose-h5:mt-8 prose-h5:mb-2 prose-h5:font-sans italic prose-h5:italic prose-h5:font-normal",
  "prose-h5:text-[1.1875rem] prose-h5:leading-[1.35] prose-h5:tracking-[0] prose-h5:text-bone sm:prose-h5:text-[1.375rem]",
  "prose-h6:mt-8 prose-h6:mb-2 prose-h6:text-[1.0625rem] prose-h6:leading-[1.4] prose-h6:uppercase prose-h6:tracking-[0.1em] prose-h6:text-clay sm:prose-h6:text-[1.1875rem]",

  "prose-li:marker:text-clay",
  "prose-strong:text-bone prose-strong:font-medium",
  // Bone, one step up from the bone/85 the paragraph is set in, and underlined
  // at rest. The underline is what identifies a link here; the value step is
  // only what keeps it from disappearing into the sentence around it.
  "prose-a:text-bone prose-a:underline prose-a:decoration-bone/40 prose-a:decoration-1 prose-a:underline-offset-[0.22em]",
  "hover:prose-a:decoration-bone hover:prose-a:decoration-2",
  // A pull quote should read as more prominent than the body, not less; the
  // plugin's italic-and-a-rule default reads as less, and so did setting it two
  // points smaller than the paragraph it was lifted from.
  "prose-blockquote:my-10 prose-blockquote:not-italic prose-blockquote:font-normal",
  "prose-blockquote:rounded-[var(--r-lg)] prose-blockquote:border prose-blockquote:border-l prose-blockquote:border-ridge prose-blockquote:border-l-ridge",
  "prose-blockquote:bg-white/60 prose-blockquote:px-6 prose-blockquote:py-5",
  "prose-blockquote:text-bone",
  "[&_blockquote_p:first-of-type]:before:content-none [&_blockquote_p:last-of-type]:after:content-none",
  "prose-code:rounded-[var(--r-sm)] prose-code:border prose-code:border-ridge prose-code:bg-white/60",
  // Bone, matching the code blocks: see CodeHighlight, where the whole theme
  // was re-keyed to bone and weight so a fenced sample and an inline span now
  // read as the same material rather than as two different palettes.
  "prose-code:px-[0.35em] prose-code:py-[0.12em] prose-code:font-normal prose-code:text-bone",
  "prose-code:before:content-none prose-code:after:content-none prose-code:[overflow-wrap:anywhere]",
].join(" ");

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

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    setState("loading");
    setPost(null);
    setCollectionTitle(null);
    setNeighbours({ newer: null, older: null });
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

  // Nothing is highlighted on the first paint. The pipeline arrives a moment
  // later and re-renders the body in colour; until then it is plain text.
  const rehypePlugins = useCodeHighlight(post?.body ?? null);

  return (
    <PageShell>
      {post && state === "ok" && <ReadingBar title={post.title} target={reading} />}

      {/*
        Not `.wrap`: 46rem is the reading measure, which is narrower than the
        site's layout measure on purpose — the title and the cover run the
        full article width while the prose inside holds to 38rem, and that
        difference is the page's hierarchy. The gutter and the section rhythm
        are the system's, though.
      */}
      <article data-crest data-hue="150 82 64" className="section-y mx-auto w-full max-w-[46rem] px-gutter">
        {state === "loading" && (
          /* Shaped like the real header rather than announced as a word, so the
             title and the cover do not jump into place over a line of text. */
          <div aria-busy="true" aria-live="polite">
            <span className="sr-only">Loading the post</span>
            <div aria-hidden="true" className="space-y-5">
              <div className="h-7 w-28 animate-pulse-soft rounded-full bg-surface" />
              <div className="h-12 w-full animate-pulse-soft rounded-full bg-surface sm:h-16" />
              <div className="h-12 w-3/4 animate-pulse-soft rounded-full bg-surface sm:h-16" />
              <div className="h-5 w-1/2 animate-pulse-soft rounded-full bg-surface" />
              <div className="aspect-[16/9] w-full animate-pulse-soft rounded-[var(--r-xl)] bg-surface" />
            </div>
          </div>
        )}

        {state === "missing" && (
          <div>
            <h1 className="display text-section">Not here</h1>
            <p className="mt-6 max-w-[34rem] text-[1.0625rem] leading-[1.7] text-bone/85">
              That post doesn&rsquo;t exist, or isn&rsquo;t published yet. The address may have
              changed when the notes moved from <code className="mono text-bone">/notes</code> to{" "}
              <code className="mono text-bone">/blog</code>.
            </p>
            <Link to="/blog" className="btn btn-quiet mt-12">
              <span aria-hidden="true">&larr;</span> All notes
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
            <p className="eyebrow">Post unavailable</p>
            <h1 className="display-tight mt-3 text-[clamp(1.75rem,6vw,2.5rem)]">
              The server didn&rsquo;t answer.
            </h1>
            <p className="mt-6 max-w-[34rem] text-[1.0625rem] leading-[1.7] text-bone/85">
              The page loaded; the post behind it didn&rsquo;t. It is served by a small machine I
              run myself, so this is usually a restart rather than anything permanent.
            </p>
            <div className="mt-12 flex flex-wrap gap-3">
              <button type="button" onClick={retry} className="btn btn-solid">
                Try again
              </button>
              <Link to="/blog" className="btn btn-quiet">
                All notes
              </Link>
              <Link to="/projects" className="btn btn-quiet">
                Projects
              </Link>
            </div>
          </div>
        )}

        {post && state === "ok" && (
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
                  <span aria-hidden="true">&larr;</span> Notes
                </Link>

                <div className="mt-12">
                  {collectionTitle ? (
                    <Link
                      to={`/projects/${post.collection}`}
                      className={`tap mono ${pill.tag} inline-flex min-h-[44px] items-center gap-2 rounded-full border px-3.5 py-2 text-xs uppercase tracking-[0.18em] transition-colors duration-150`}
                    >
                      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-clay" />
                      {collectionTitle}
                    </Link>
                  ) : (
                    <p className="eyebrow">Note</p>
                  )}
                </div>

                <h1 className="display mt-3 text-[clamp(2.1rem,8.5vw,3.75rem)] leading-[0.96]">
                  {post.title}
                </h1>

                {/* The second voice, under the display line — the one thing
                    on a post between a 12px label and the title. In the sans
                    at 18-20px it was simply the first paragraph set slightly
                    large, which is the register this page has deliberately
                    emptied out. */}
                {post.subtitle && (
                  <p className="editorial mt-6 max-w-[30rem] text-[1.375rem] text-bone sm:text-[1.75rem]">
                    {post.subtitle}
                  </p>
                )}

                {/* A name and a face, which a personal blog had nowhere above
                    the fold, beside the two facts that were already here. */}
                <Byline
                  className="mt-12 border-t border-edge pt-6"
                  meta={
                    <div className="flex flex-wrap items-center gap-2.5">
                      {post.publishedAt && (
                        <MetaPill>
                          <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
                        </MetaPill>
                      )}
                      <MetaPill>
                        <span aria-hidden="true" className="h-1 w-1 rounded-full bg-clay" />
                        {post.readingMinutes} min read
                      </MetaPill>
                    </div>
                  }
                />
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

              {/* The query container the full-width blocks measure themselves
                  against; see FULL_WIDTH. It has no appearance of its own. */}
              <div className="sm:[container-type:inline-size]">
                <div className={PROSE}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={rehypePlugins}
                    components={markdown}
                  >
                    {post.body}
                  </ReactMarkdown>
                </div>
              </div>
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
                  <li key={l.url}>
                    <a href={l.url} target="_blank" rel="noreferrer noopener" className="btn btn-quiet">
                      {l.label} <span aria-hidden="true">&#8599;</span>
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
        )}
      </article>
    </PageShell>
  );
}
