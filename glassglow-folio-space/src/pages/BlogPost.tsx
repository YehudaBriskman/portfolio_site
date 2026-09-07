import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import PageShell from "@/components/PageShell";
import Scenery from "@/components/scene/Scenery";
import { blog, formatDate, type Post } from "@/services/blog";

export default function BlogPost() {
  const { slug = "" } = useParams();
  const [post, setPost] = useState<Post | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing" | "error">("loading");

  useEffect(() => {
    let alive = true;
    setState("loading");
    blog.post(slug)
      .then((p) => {
        if (!alive) return;
        setPost(p);
        setState("ok");
        // No SSR here, so the tab title is set on the client. Social crawlers do
        // not run JS and will not see this — that is a known gap, tracked.
        document.title = `${p.seo?.title ?? p.title} — Yehuda Briskman`;
      })
      .catch((e) => {
        if (!alive) return;
        setState(e instanceof Error && e.message === "not-found" ? "missing" : "error");
      });
    return () => {
      alive = false;
      document.title = "Yehuda Briskman — Full-stack engineer & team lead";
    };
  }, [slug]);

  return (
    <PageShell>
      <article className="isolate relative mx-auto max-w-3xl px-6 pb-28 pt-40 sm:pb-36">
        <Scenery variant="ripples" />
        <Link
          to="/blog"
          className="mono inline-flex items-center gap-2 text-[0.6875rem] uppercase tracking-[0.22em] text-bone/45 transition-colors hover:text-sodium"
        >
          <span aria-hidden="true">←</span> Blog
        </Link>

        {state === "loading" && <p className="mono mt-12 text-xs text-bone/40">Loading…</p>}
        {state === "missing" && (
          <div className="mt-12">
            <h1 className="display-tight text-section">Not here</h1>
            <p className="mt-4 text-sm text-bone/70">
              That post doesn&rsquo;t exist, or isn&rsquo;t published yet.
            </p>
          </div>
        )}
        {state === "error" && (
          <p className="mt-12 text-sm text-bone/70">
            Couldn&rsquo;t load that one. Try again in a moment.
          </p>
        )}

        {post && state === "ok" && (
          <>
            <header className="mt-10">
              <div className="mono flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.6875rem] uppercase tracking-[0.2em] text-bone/40">
                <time dateTime={post.publishedAt ?? undefined}>{formatDate(post.publishedAt)}</time>
                <span aria-hidden="true">·</span>
                <span>{post.readingMinutes} min</span>
              </div>
              <h1 className="display mt-5 text-[clamp(2rem,5vw,3.4rem)] leading-[0.98]">{post.title}</h1>
              {post.subtitle && <p className="mt-4 text-lg text-bone/65">{post.subtitle}</p>}
            </header>

            {/* No rehype-raw on purpose: without it react-markdown will not render
                raw HTML, which removes the entire stored-content XSS surface. */}
            {post.coverImage && (
              <img
                src={post.coverImage}
                alt=""
                loading="lazy"
                decoding="async"
                className="mt-10 w-full rounded-lg border border-edge object-cover"
              />
            )}

            <div
              className="prose prose-invert mt-12 max-w-none
                prose-headings:font-[Archivo] prose-headings:tracking-tight
                prose-p:text-bone/75 prose-li:text-bone/75
                prose-a:text-sodium prose-a:no-underline hover:prose-a:underline
                prose-strong:text-bone
                prose-code:text-sodium prose-code:before:content-none prose-code:after:content-none
                prose-pre:border prose-pre:border-edge prose-pre:bg-surface"
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.body}</ReactMarkdown>
            </div>

            {post.links.length > 0 && (
              <ul className="mono mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-edge pt-8 text-[0.6875rem] uppercase tracking-[0.2em]">
                {post.links.map((l) => (
                  <li key={l.url}>
                    <a href={l.url} target="_blank" rel="noreferrer noopener" className="text-sodium transition-opacity hover:opacity-70">
                      {l.label} ↗
                    </a>
                  </li>
                ))}
              </ul>
            )}

            {post.tags.length > 0 && (
              <ul className="mono mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[0.6875rem] uppercase tracking-[0.18em] text-bone/40">
                {post.tags.map((t) => (
                  <li key={t}>
                    <Link to={`/blog?tag=${encodeURIComponent(t)}`} className="transition-colors hover:text-sodium">
                      #{t}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </article>
    </PageShell>
  );
}
