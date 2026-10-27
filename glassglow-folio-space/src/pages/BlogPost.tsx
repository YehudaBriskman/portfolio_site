import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import PageShell from "@/components/PageShell";
import { POST_LAYERS } from "@/components/scene/LayerStack";
import Ridge from "@/components/Ridge";
import PostFooterNav from "@/components/notes/PostFooterNav";
import ReadingBar from "@/components/notes/ReadingBar";
import TagPill from "@/components/notes/TagPill";
import { blog, formatDate, type Post, type PostSummary } from "@/services/blog";

/* A break inside a post is the same kind of break as one between the home
   page's sections, so it gets the same silhouette rather than a grey line. */
function MarkdownRule() {
  return (
    <div className="not-prose my-12 h-6 w-full opacity-70" aria-hidden="true">
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
 *
 * Defined at module scope so the object identity is stable across renders.
 */
const markdown: Components = {
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
      <span className="not-prose my-9 block">
        <img
          src={src}
          alt={alt ?? ""}
          loading="lazy"
          decoding="async"
          className="bleed block w-full border-y border-edge sm:rounded-[var(--r-md)] sm:border"
        />
        {title && (
          <span className="mono mt-3 block text-center text-[0.75rem] tracking-[0.06em] text-clay">
            {title}
          </span>
        )}
      </span>
    );
  },

  /* Darker than a panel, not lighter: a code block is a well the page is cut
     into, which is also what stops it competing with the cards elsewhere. */
  pre({ children }) {
    return (
      <pre className="not-prose bleed my-9 overflow-x-auto border-y border-edge bg-bitumen px-5 py-4 font-mono text-[0.8125rem] leading-[1.65] text-bone/90 [scrollbar-width:thin] sm:rounded-[var(--r-md)] sm:border sm:text-[0.875rem]">
        {children}
      </pre>
    );
  },

  table({ children }) {
    return (
      <div className="not-prose bleed my-9 overflow-x-auto px-5 [scrollbar-width:thin] sm:px-0">
        <table className="w-full min-w-[30rem] border-collapse text-left">{children}</table>
      </div>
    );
  },
  th({ children }) {
    return (
      <th className="mono border-b border-edge pb-3 pr-6 text-[0.6875rem] uppercase tracking-[0.18em] text-clay">
        {children}
      </th>
    );
  },
  td({ children }) {
    return (
      <td className="border-b border-edge/70 py-3 pr-6 align-top text-[0.9375rem] leading-[1.6] text-bone/85">
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
 * an underline rather than colour alone — sodium against bone/85 is 1.30:1
 * between the two text colours, well under the 3:1 that would let colour do the
 * job by itself.
 */
const PROSE = [
  "prose prose-invert mx-auto mt-12 max-w-[38rem] sm:mt-16",
  "prose-headings:font-[Archivo] prose-headings:tracking-[-0.02em] prose-headings:text-bone",
  // Space above a heading is ~2.5x the space below it. The plugin's default is
  // nearer 2:1, which is what made every section run into the one before it.
  "prose-h2:mt-14 prose-h2:mb-4 prose-h2:text-[1.6rem] prose-h2:leading-[1.1] sm:prose-h2:text-[2rem]",
  "prose-h3:mt-10 prose-h3:mb-3 prose-h3:text-[1.25rem] sm:prose-h3:text-[1.4rem]",
  "prose-h4:mt-8 prose-h4:mb-2 prose-h4:text-[1.0625rem]",
  "prose-p:text-bone/85 prose-p:text-[1.0625rem] prose-p:leading-[1.7] sm:prose-p:text-[1.1875rem] sm:prose-p:leading-[1.75]",
  "prose-li:text-bone/85 prose-li:leading-[1.7] prose-li:marker:text-sodium",
  "prose-strong:text-bone prose-strong:font-medium",
  "prose-a:text-sodium prose-a:underline prose-a:decoration-sodium/40 prose-a:decoration-1 prose-a:underline-offset-[0.22em]",
  "hover:prose-a:decoration-sodium hover:prose-a:decoration-2",
  // A pull quote should read as more prominent than the body, not less; the
  // plugin's italic-and-a-rule default reads as less.
  "prose-blockquote:my-10 prose-blockquote:not-italic prose-blockquote:font-normal",
  "prose-blockquote:rounded-[var(--r-md)] prose-blockquote:border prose-blockquote:border-l prose-blockquote:border-edge prose-blockquote:border-l-edge",
  "prose-blockquote:bg-surface/40 prose-blockquote:px-5 prose-blockquote:py-4",
  "prose-blockquote:text-bone prose-blockquote:text-[1.0625rem] prose-blockquote:leading-[1.7]",
  "[&_blockquote_p:first-of-type]:before:content-none [&_blockquote_p:last-of-type]:after:content-none",
  "prose-code:rounded-[6px] prose-code:border prose-code:border-edge prose-code:bg-surface/70",
  "prose-code:px-[0.35em] prose-code:py-[0.12em] prose-code:font-normal prose-code:text-sodium",
  "prose-code:before:content-none prose-code:after:content-none prose-code:[overflow-wrap:anywhere]",
].join(" ");

export default function BlogPost() {
  const { slug = "" } = useParams();
  const [post, setPost] = useState<Post | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing" | "error">("loading");
  const [collectionTitle, setCollectionTitle] = useState<string | null>(null);
  const [neighbours, setNeighbours] = useState<{ newer: PostSummary | null; older: PostSummary | null }>({
    newer: null,
    older: null,
  });

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
        // No SSR here, so the tab title is set on the client. Social crawlers do
        // not run JS and will not see this — that is a known gap, tracked.
        document.title = `${p.title} · Yehuda Briskman`;
      })
      .catch((e) => {
        if (!alive) return;
        setState(e instanceof Error && e.message === "not-found" ? "missing" : "error");
      });
    return () => {
      alive = false;
      document.title = "Yehuda Briskman · Full-stack engineer & team lead";
    };
  }, [slug]);

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

  return (
    <PageShell reading layers={POST_LAYERS}>
      {post && state === "ok" && <ReadingBar title={post.title} />}

      <article data-crest data-hue="150 82 64" className="mx-auto w-full max-w-[46rem] px-5 pb-24 pt-24 sm:px-6 sm:pb-32 sm:pt-32 lg:pt-40">
        {state === "loading" && <p className="mono text-xs text-clay">Loading…</p>}
        {state === "missing" && (
          <div>
            <h1 className="display-tight text-section">Not here</h1>
            <p className="mt-4 text-[0.9375rem] text-bone/85">
              That post doesn&rsquo;t exist, or isn&rsquo;t published yet.
            </p>
            <Link to="/blog" className="btn btn-quiet mt-8">
              <span aria-hidden="true">&larr;</span> All notes
            </Link>
          </div>
        )}
        {state === "error" && (
          <p className="text-[0.9375rem] text-bone/85">
            Couldn&rsquo;t load that one. Try again in a moment.
          </p>
        )}

        {post && state === "ok" && (
          <>
            <header className="isolate relative">

              {/* On a phone the back affordance lives in the bar at the foot of
                  the screen, where it is still reachable three thousand pixels
                  into the article. */}
              <Link
                to="/blog"
                className="mono hidden min-h-[44px] items-center gap-2 rounded-full border border-edge px-4 py-2 text-[0.75rem] uppercase tracking-[0.16em] text-clay transition-colors duration-150 hover:border-sodium/50 hover:text-sodium sm:inline-flex"
              >
                <span aria-hidden="true">&larr;</span> Notes
              </Link>

              <div className="mt-8 sm:mt-10">
                {collectionTitle ? (
                  <Link
                    to={`/projects/${post.collection}`}
                    className="tap mono inline-flex min-h-[44px] items-center gap-2 rounded-full border border-sodium/35 bg-sodium/10 px-3.5 py-2 text-[0.6875rem] uppercase tracking-[0.18em] text-sodium transition-colors duration-150 hover:bg-sodium/20"
                  >
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-sodium" />
                    {collectionTitle}
                  </Link>
                ) : (
                  <p className="eyebrow">Note</p>
                )}
              </div>

              <h1 className="display mt-5 text-[clamp(2.1rem,8.5vw,3.75rem)] leading-[0.96]">
                {post.title}
              </h1>

              {post.subtitle && (
                <p className="mt-5 max-w-[32rem] text-lg leading-[1.5] text-bone/85 sm:text-xl">
                  {post.subtitle}
                </p>
              )}

              <div className="mt-7 flex flex-wrap items-center gap-2.5">
                {post.publishedAt && (
                  <span className="meta-pill">
                    <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
                  </span>
                )}
                <span className="meta-pill">
                  <span aria-hidden="true" className="h-1 w-1 rounded-full bg-sodium" />
                  {post.readingMinutes} min read
                </span>
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
                className="bleed mt-10 aspect-[16/9] w-full border-y border-edge object-cover sm:rounded-[var(--r-lg)] sm:border"
              />
            )}

            <div className={PROSE}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdown}>
                {post.body}
              </ReactMarkdown>
            </div>

            {post.tags.length > 0 && (
              <ul className="mt-14 flex flex-wrap gap-2">
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

            <div className="mt-16 opacity-70">
              <Ridge variant={2} />
            </div>

            <PostFooterNav newer={neighbours.newer} older={neighbours.older} />
          </>
        )}
      </article>
    </PageShell>
  );
}
