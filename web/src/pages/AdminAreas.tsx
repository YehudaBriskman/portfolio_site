import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import { Empty, EmptyState, ErrorState, LoadingRows, PageHeader, StatePill } from "@/components/admin/ui";
import { useAdminWords } from "@/i18n/admin";
import { admin, type AdminCollection, type AdminPost } from "@/services/admin";

/*
 * The areas index. There was no such page before: areas were reachable only as
 * a row of chips on the posts screen, so there was nowhere to see an area's
 * repo, its post count and its visibility together. Since #288 it is a table
 * in the order the site shows them, the order itself in the last column.
 */
export default function AdminAreas() {
  const w = useAdminWords();
  const [cols, setCols] = useState<AdminCollection[] | null>(null);
  const [posts, setPosts] = useState<AdminPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([admin.collections(), admin.list()])
      .then(([c, p]) => {
        setCols(c);
        setPosts(p);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const retry = () => {
    setError(null);
    load();
  };

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
    <AdminShell title={w.nav.areas} section="areas" counts={{ posts: posts?.length, areas: cols?.length }}>
      <div className="a-wrap">
        <PageHeader
          title={w.nav.areas}
          description={
            <>
              An area is either this site&rsquo;s own notes or one project. A project area carries its own posts,
              links and repository.
            </>
          }
          actions={
            <Link to="/admin/areas/new" className="a-btn a-btn-primary">
              <Plus aria-hidden="true" />
              {w.newArea}
            </Link>
          }
        />

        <p className="sr-only" role="status">
          {cols === null ? "Loading areas" : `${ordered.length} areas`}
        </p>

        {error ? (
          <ErrorState message={error} onRetry={retry} />
        ) : cols === null ? (
          <LoadingRows rows={4} />
        ) : ordered.length === 0 ? (
          <EmptyState
            title="No areas yet"
            action={
              <Link to="/admin/areas/new" className="a-btn a-btn-primary">
                Create the first area
              </Link>
            }
          >
            Projects on the public site come from here. Nothing appears at /projects until an area exists.
          </EmptyState>
        ) : (
          <div className="a-box overflow-x-auto">
            <table className="a-table">
              <caption className="sr-only">{w.nav.areas}</caption>
              <thead>
                <tr>
                  <th scope="col">{w.colArea}</th>
                  <th scope="col" className="hidden md:table-cell">
                    {w.colRepo}
                  </th>
                  <th scope="col" className="a-num">
                    {w.colNotes}
                  </th>
                  <th scope="col" className="hidden sm:table-cell">
                    {w.colStatus}
                  </th>
                  <th scope="col" className="a-num hidden sm:table-cell">
                    {w.colOrder}
                  </th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((c) => (
                  <tr key={c.slug}>
                    <td>
                      <Link to={`/admin/areas/${c.slug}`} className="a-row-title">
                        {c.title}
                      </Link>
                      <span className="a-row-meta">
                        <span>{c.kind === "site" ? "Site notes" : "Project"}</span>
                        <code dir="ltr">/{c.slug}</code>
                        {c.status === "hidden" && (
                          <span className="sm:hidden">
                            <StatePill state="hidden" />
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="hidden md:table-cell">
                      {c.repo ? (
                        <code dir="ltr" className="text-[0.8125rem]">
                          {c.repo.owner}/{c.repo.name}
                        </code>
                      ) : (
                        <Empty label="No repository" />
                      )}
                    </td>
                    <td className="a-num">{countFor(c.slug)}</td>
                    <td className="a-fit hidden sm:table-cell">
                      <StatePill state={c.status} />
                    </td>
                    <td className="a-num hidden sm:table-cell">{c.order}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
