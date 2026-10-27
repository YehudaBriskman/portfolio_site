import { Link, useLocation } from "react-router-dom";
import PageShell from "@/components/PageShell";
import { POST_LAYERS } from "@/components/scene/LayerStack";

/*
 * The one page that still looked like a different project.
 *
 * This was Lovable's scaffold: a white card on `bg-gray-100` with
 * `text-gray-600`, Tailwind's stock greys on a site that has none of them, and
 * no plate, no chrome and no way onward except Home. It is also the page a
 * visitor is most likely to meet by accident — a stale link, a mistyped slug,
 * a search result pointing at something that moved — so it is the worst place
 * on the site to break the illusion that anyone is looking after it.
 *
 * It now uses the same shell every other content page uses, which means it
 * arrives with the nav, the plates and the footer for free, and the ways
 * onward are the ways onward from anywhere else.
 */
export default function NotFound() {
  const { pathname } = useLocation();

  return (
    <PageShell layers={POST_LAYERS}>
      <section className="wrap section-y">
        <p className="eyebrow">Error 404</p>
        <h1 className="display mt-3 text-section">Not here</h1>

        <p className="editorial mt-6 max-w-xl text-sub text-clay">
          Whatever was at this address has moved, or never existed.
        </p>

        {/*
         * The path is quoted back deliberately. A 404 that does not say what
         * it could not find leaves the reader unable to tell a typo from a
         * dead link, and the one thing they can act on is the spelling.
         */}
        <p className="mono mt-6 break-all text-xs text-haze-2">{pathname}</p>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link to="/" className="btn btn-solid">
            Home
          </Link>
          <Link to="/projects" className="btn btn-quiet">
            Projects
          </Link>
          <Link to="/blog" className="btn btn-quiet">
            Notes
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
