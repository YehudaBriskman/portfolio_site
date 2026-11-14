import { Link, useLocation } from "react-router-dom";
import PageShell from "@/components/PageShell";
import { useNotFoundWords } from "@/i18n/chrome";
import "@/components/phone/tokens.css";
import "@/components/phone/pages-forms.css";

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
  const w = useNotFoundWords();

  return (
    <PageShell>
      <section className="wrap section-y">
        <p className="eyebrow">{w.eyebrow}</p>
        <h1 className="display mt-3 text-section">{w.title}</h1>

        <p className="editorial mt-6 max-w-xl text-sub text-clay">
          {w.body}
        </p>

        {/*
         * The path is quoted back deliberately. A 404 that does not say what
         * it could not find leaves the reader unable to tell a typo from a
         * dead link, and the one thing they can act on is the spelling.
         *
         * In a well rather than loose on the paper, because that is what it
         * is: a value, quoted, at 7.35:1 on a fill of white at 70%. As a bare
         * line of grey mono under a display heading it read as a caption on
         * the heading rather than as the thing that could not be found. 22px
         * of corner on a box this size, matching the form fields — it is the
         * same kind of object, a box with a string in it.
         *
         * No wash. There is no group here and so no position for the hue
         * cycle to read; see the note in BlogPost.tsx.
         */}
        <p data-ph="path" className="mono mt-6 inline-block max-w-full break-all rounded-[var(--r-md)] border border-ridge bg-sheet/70 px-4 py-2.5 text-xs text-ink-soft">
          {pathname}
        </p>

        <div className="mt-12 flex flex-wrap gap-3" data-ph="onward-list">
          <Link to="/" className="btn btn-solid">
            {w.home}
          </Link>
          <Link to="/projects" className="btn btn-quiet">
            {w.projects}
          </Link>
          <Link to="/blog" className="btn btn-quiet">
            {w.notes}
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
