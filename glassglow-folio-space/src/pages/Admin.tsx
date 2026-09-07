import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageShell from "@/components/PageShell";
import { admin, type AdminPost } from "@/services/admin";

const STATUS_TONE: Record<string, string> = {
  published: "text-sodium",
  draft: "text-bone/55",
  archived: "text-bone/30",
};

export default function Admin() {
  const [posts, setPosts] = useState<AdminPost[] | null>(null);
  const [who, setWho] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    admin
      .list()
      .then(setPosts)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));

  useEffect(() => {
    admin.me().then((m) => setWho(m.login)).catch(() => setWho(""));
    load();
  }, []);

  return (
    <PageShell>
      <section className="isolate relative mx-auto max-w-5xl px-6 pb-28 pt-40">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">{who ? `Signed in as ${who}` : "Admin"}</p>
            <h1 className="display-tight mt-4 text-section">Posts</h1>
          </div>
          <Link
            to="/admin/posts/new"
            className="mono border border-sodium px-6 py-3 text-xs uppercase tracking-[0.2em] text-sodium transition-colors hover:bg-sodium hover:text-bitumen"
          >
            New post
          </Link>
        </div>

        {error && <p className="mt-10 text-sm text-bone/70">{error}</p>}
        {!error && posts === null && <p className="mono mt-10 text-xs text-bone/40">Loading…</p>}
        {posts?.length === 0 && <p className="mt-10 text-sm text-bone/70">No posts yet.</p>}

        <ul className="mt-12 divide-y divide-edge border-y border-edge">
          {(posts ?? []).map((p) => (
            <li key={p.slug} className="flex flex-wrap items-center gap-x-6 gap-y-2 py-5">
              <Link to={`/admin/posts/${p.slug}`} className="min-w-0 flex-1 group">
                <p className="text-base text-bone transition-colors group-hover:text-sodium">{p.title}</p>
                <p className="mono mt-1 text-[0.625rem] uppercase tracking-[0.18em] text-bone/35">
                  /{p.slug} · {p.readingMinutes} min · {p.tags.join(" ") || "no tags"}
                </p>
              </Link>
              <span className={`mono text-[0.625rem] uppercase tracking-[0.2em] ${STATUS_TONE[p.status]}`}>
                {p.status}
              </span>
              {p.status === "published" && (
                <a
                  href={`https://yehudabriskman.com/notes/${p.slug}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mono text-[0.625rem] uppercase tracking-[0.2em] text-bone/40 transition-colors hover:text-bone"
                >
                  view ↗
                </a>
              )}
            </li>
          ))}
        </ul>
      </section>
    </PageShell>
  );
}
