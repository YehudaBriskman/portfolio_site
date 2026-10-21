import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AdminShell from "@/components/admin/AdminShell";
import { admin, type AdminCollection, type AdminPost } from "@/services/admin";

type StatusFilter = "all" | "draft" | "published" | "archived";
const STATUSES: StatusFilter[] = ["all", "draft", "published", "archived"];

/** Coarse and local — a list only needs "how stale", not a calendar. */
function relativeTime(iso: string): string {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  const steps: Array<[number, string]> = [
    [60, "just now"],
    [3600, "m"],
    [86400, "h"],
    [604800, "d"],
  ];
  if (seconds < steps[0][0]) return "just now";
  if (seconds < steps[1][0]) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < steps[2][0]) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < steps[3][0]) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function Admin() {
  const [posts, setPosts] = useState<AdminPost[] | null>(null);
  const [cols, setCols] = useState<AdminCollection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();

  // Filter state lives in the URL, so a filtered view is bookmarkable and the
  // browser's Back button does what it looks like it should.
  const query = params.get("q") ?? "";
  const status = (params.get("status") as StatusFilter | null) ?? "all";
  const area = params.get("area") ?? "all";

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  useEffect(() => {
    Promise.all([admin.list(), admin.collections()])
      .then(([p, c]) => {
        setPosts(p);
        setCols(c);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  const areaTitle = useMemo(() => {
    const map = new Map((cols ?? []).map((c) => [c.slug, c.title]));
    return (slug: string) => map.get(slug) ?? slug;
  }, [cols]);

  /* The list endpoint already returns every post, so searching and filtering
     are local: instant on a phone, and no round-trip per keystroke. */
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (posts ?? [])
      .filter((p) => (status === "all" ? true : p.status === status))
      .filter((p) => (area === "all" ? true : p.collection === area))
      .filter((p) =>
        !q
          ? true
          : [p.title, p.slug, p.excerpt, ...p.tags].some((field) => field.toLowerCase().includes(q)),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [posts, query, status, area]);

  const filtering = Boolean(query) || status !== "all" || area !== "all";

  return (
    <AdminShell
      title="Posts"
      section="posts"
      counts={{ posts: posts?.length, areas: cols?.length }}
      actions={
        <Link to="/admin/posts/new" className="a-btn a-btn-primary a-icon-btn shrink-0" aria-label="New post">
          <span aria-hidden="true">+</span>
        </Link>
      }
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="display-tight text-[1.75rem] lg:text-[2.25rem]">Posts</h1>
        <div className="hidden gap-3 lg:flex">
          <Link to="/admin/areas/new" className="a-btn">New area</Link>
          <Link to="/admin/posts/new" className="a-btn a-btn-primary">New post</Link>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="lg:max-w-xs lg:flex-1">
          <span className="sr-only">Search posts</span>
          <input
            type="search"
            className="a-input"
            placeholder="Search title, slug, tag"
            value={query}
            onChange={(e) => setParam("q", e.target.value)}
          />
        </label>

        <div className="a-seg overflow-x-auto" role="group" aria-label="Filter by status">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={status === s}
              onClick={() => setParam("status", s)}
            >
              {s}
            </button>
          ))}
        </div>

        <label className="lg:max-w-[12rem]">
          <span className="sr-only">Filter by area</span>
          <select className="a-select" value={area} onChange={(e) => setParam("area", e.target.value)}>
            <option value="all">All areas</option>
            {(cols ?? []).map((c) => (
              <option key={c.slug} value={c.slug}>{c.title}</option>
            ))}
          </select>
        </label>
      </div>

      <p className="sr-only" role="status">
        {posts === null ? "Loading posts" : `${shown.length} posts`}
      </p>

      {error && <p className="a-card mt-8 p-4 text-sm text-bone/70">{error}</p>}
      {!error && posts === null && <p className="mono mt-8 text-xs text-clay">Loading…</p>}

      {posts !== null && shown.length === 0 && (
        <div className="a-card mt-8 p-8 text-center">
          <p className="display-tight text-2xl">
            {posts.length === 0 ? "Nothing written yet" : "No posts match those filters"}
          </p>
          <div className="mt-6 flex justify-center">
            {posts.length === 0 ? (
              <Link to="/admin/posts/new" className="a-btn a-btn-primary">Write the first post</Link>
            ) : (
              <button type="button" className="a-btn" onClick={() => setParams({}, { replace: true })}>
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      {shown.length > 0 && (
        <ul className="mt-6">
          {shown.map((p) => (
            <li key={p.slug} className="relative">
              <Link to={`/admin/posts/${p.slug}`} className="a-row group pr-14">
                {/* A dot in the gutter never wraps, and scans straight down the
                    left edge — which the wrapping status word did not. */}
                <span className={`a-dot a-dot-${p.status}`} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.9375rem] text-bone transition-colors group-hover:text-sodium">
                    {p.title}
                  </span>
                  <span className="mono mt-1 block truncate text-[0.6875rem] tracking-[0.14em] text-clay">
                    {areaTitle(p.collection)} · {p.status === "published" ? "published" : `edited ${relativeTime(p.updatedAt)}`} · {p.readingMinutes}m
                    {p.tags.length > 0 ? ` · ${p.tags.join(" ")}` : ""}
                  </span>
                </span>
                <span className="mono hidden shrink-0 text-[0.625rem] uppercase tracking-[0.2em] text-clay lg:block">
                  {p.status}
                </span>
              </Link>
              {p.status === "published" && (
                <a
                  href={`https://yehudabriskman.com/blog/${p.slug}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="a-btn a-btn-ghost a-icon-btn absolute right-1 top-1/2 -translate-y-1/2"
                  aria-label={`View ${p.title} on the public site`}
                >
                  <span aria-hidden="true">↗</span>
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}
