import { Link } from "react-router-dom";
import { formatDate, type PostSummary } from "@/services/blog";

export default function PostList({ posts }: { posts: PostSummary[] }) {
  if (posts.length === 0) return <p className="text-sm text-bone/60">Nothing published here yet.</p>;
  return (
    <ul className="divide-y divide-edge border-y border-edge">
      {posts.map((p) => (
        <li key={p.slug}>
          <Link to={`/blog/${p.slug}`} className="group flex gap-6 py-8">
            {p.coverImage && (
              <img
                src={p.coverImage}
                alt=""
                loading="lazy"
                decoding="async"
                className="hidden h-24 w-36 shrink-0 border border-edge object-cover sm:block"
              />
            )}
            <div className="min-w-0">
              <div className="mono flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.6875rem] uppercase tracking-[0.2em] text-bone/40">
                <time dateTime={p.publishedAt ?? undefined}>{formatDate(p.publishedAt)}</time>
                <span aria-hidden="true">·</span>
                <span>{p.readingMinutes} min</span>
                {p.tags.map((t) => (
                  <span key={t} className="text-bone/30">#{t}</span>
                ))}
              </div>
              <h3 className="display-tight mt-3 text-2xl text-bone transition-colors group-hover:text-sodium">
                {p.title}
              </h3>
              {p.subtitle && <p className="mt-2 text-base text-bone/60">{p.subtitle}</p>}
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-bone/55">{p.excerpt}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
