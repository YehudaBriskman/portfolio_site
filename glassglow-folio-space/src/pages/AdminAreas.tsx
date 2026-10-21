import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AdminShell from "@/components/admin/AdminShell";
import { admin, type AdminCollection, type AdminPost } from "@/services/admin";

/*
 * The areas index. There was no such page before: areas were reachable only as
 * a row of chips on the posts screen, so there was nowhere to see an area's
 * repo, its post count and its visibility together.
 */
export default function AdminAreas() {
  const [cols, setCols] = useState<AdminCollection[] | null>(null);
  const [posts, setPosts] = useState<AdminPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([admin.collections(), admin.list()])
      .then(([c, p]) => {
        setCols(c);
        setPosts(p);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  const countFor = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of posts ?? []) counts.set(p.collection, (counts.get(p.collection) ?? 0) + 1);
    return (slug: string) => counts.get(slug) ?? 0;
  }, [posts]);

  const ordered = useMemo(
    () => [...(cols ?? [])].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title)),
    [cols],
  );

  return (
    <AdminShell
      title="Areas"
      section="areas"
      counts={{ posts: posts?.length, areas: cols?.length }}
      actions={
        <Link to="/admin/areas/new" className="a-btn a-btn-primary a-icon-btn shrink-0" aria-label="New area">
          <span aria-hidden="true">+</span>
        </Link>
      }
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="display-tight text-[1.75rem] lg:text-[2.25rem]">Areas</h1>
        <Link to="/admin/areas/new" className="a-btn a-btn-primary hidden lg:inline-flex">New area</Link>
      </div>

      <p className="a-hint mt-3 max-w-prose">
        An area is either this site&rsquo;s own notes or one project. A project area carries its
        own posts, links and repository.
      </p>

      <p className="sr-only" role="status">
        {cols === null ? "Loading areas" : `${ordered.length} areas`}
      </p>

      {error && <p className="a-card mt-8 p-4 text-sm text-bone/70">{error}</p>}
      {!error && cols === null && <p className="mono mt-8 text-xs text-clay">Loading…</p>}

      {cols !== null && ordered.length === 0 && (
        <div className="a-card mt-8 p-8 text-center">
          <p className="display-tight text-2xl">No areas yet</p>
          <p className="a-hint mx-auto mt-3 max-w-sm">
            Projects on the public site come from here. Nothing appears at /projects until an
            area exists.
          </p>
          <Link to="/admin/areas/new" className="a-btn a-btn-primary mt-6">Create the first area</Link>
        </div>
      )}

      {ordered.length > 0 && (
        <ul className="mt-6">
          {ordered.map((c) => (
            <li key={c.slug}>
              <Link to={`/admin/areas/${c.slug}`} className="a-row group">
                <span
                  className={`a-dot ${c.status === "hidden" ? "a-dot-hidden" : "a-dot-published"}`}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.9375rem] text-bone transition-colors group-hover:text-sodium">
                    {c.title}
                  </span>
                  <span className="mono mt-1 block truncate text-[0.6875rem] tracking-[0.14em] text-clay">
                    {c.kind} · /{c.slug} · {countFor(c.slug)} posts
                    {c.repo ? ` · ${c.repo.owner}/${c.repo.name}` : ""}
                    {c.status === "hidden" ? " · hidden" : ""}
                  </span>
                </span>
                <span className="mono hidden shrink-0 tabular-nums text-[0.625rem] uppercase tracking-[0.2em] text-clay lg:block">
                  {c.order}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}
