import { Link } from "react-router-dom";
import InkRule from "@/components/motion/InkRule";
import { links } from "@/data/links";
import { contact } from "@/data/site";

/*
 * The site footer.
 *
 * It used to live inside the contact section, which meant it existed on the
 * home page and nowhere else — the email address, the profiles, the colophon
 * and the links back into the site were all missing from every project page
 * and every post, which are exactly the pages someone arrives on from a
 * search.
 *
 * Deliberately not cards, and this is the line the rest of the page draws
 * too.
 *
 * "Everything in cards" taken literally ends here, with four boxes of link
 * lists at the bottom of every page — which is the point at which a card
 * stops meaning anything, because a device that marks everything marks
 * nothing. A card says "this is one object, separate from the one next to
 * it". A footer is the opposite claim: it is the edge of the page, one
 * continuous band of small print, and its four columns are facets of a single
 * thing rather than four things. The hairlines already say where it begins
 * and where the colophon starts, and that is the whole amount of structure it
 * needs.
 *
 * What did change is the ink. Every colour here was an alpha of --bone chosen
 * against a near-black ground; on paper those alphas wash out, so each role
 * is now a solid token with a measured ratio against #ECE8DC.
 */
export default function SiteFooter() {
  /* --ink at 15.17:1 on paper. Was --bone/85, which is the same colour
     diluted for no reason now that the ground is light. */
  const linkRow =
    "-my-1 inline-flex min-h-11 items-center text-sm text-ink transition-colors hover:text-sodium sm:min-h-0 sm:py-1";

  return (
    <footer className="mt-section-sm pt-12">
      {/* The band's top edge, drawn rather than switched on — the one place in
          the footer that gets any motion at all. */}
      <InkRule className="mb-12" />

      <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="eyebrow">Pages</p>
          {/* `space-y-1` and not the usual item gap: every row here already
              carries a 44px tap target, so the touch rhythm is the rhythm and
              anything on top of it only makes the footer taller. */}
          <ul className="mt-3 space-y-1">
            {[
              { to: "/", label: "Home" },
              { to: "/projects", label: "Projects" },
              { to: "/blog", label: "Notes" },
            ].map((l) => (
              <li key={l.to}>
                {/* Route change, not a page load: an anchor here re-downloaded
                    and re-booted the whole bundle. */}
                <Link to={l.to} className={linkRow}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="eyebrow">Work</p>
          <ul className="mt-3 space-y-1">
            {[
              { href: "https://windom.app", label: "WindoM", note: "Chrome Web Store" },
              { href: "https://github.com/YehudaBriskman/Bothy", label: "Bothy", note: "Self-hosted" },
            ].map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={`${linkRow} gap-2`}
                >
                  {l.label}
                  {/* --ink-soft, 6.37:1 on paper. */}
                  <span className="mono text-xs text-clay">{l.note}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="eyebrow">Elsewhere</p>
          <ul className="mt-3 space-y-1">
            {links.map((l) => (
              <li key={l.name}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={`${linkRow} capitalize`}
                >
                  {l.name} <span aria-hidden="true" className="ml-1 text-clay">&#8599;</span>
                </a>
              </li>
            ))}
            <li>
              <a href={`mailto:${contact.email}`} className={linkRow}>
                Email
              </a>
            </li>
          </ul>
        </div>

        <div>
          <p className="eyebrow">Colophon</p>
          {/* Every claim here is checkable, which is the point of the page. */}
          <p className="mt-3 text-sm leading-relaxed text-clay">
            Built with React and TypeScript. Runs on a single Arm machine I administer
            myself, behind Traefik and cert-manager, with the content in CouchDB.
          </p>
          <p className="mono mt-3 text-xs text-clay">
            No trackers. No cookie banner, because there are no cookies.
          </p>
        </div>
      </div>

      <div className="mono mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-edge pt-6 text-xs text-clay">
        <span>&copy; {new Date().getFullYear()} Yehuda Briskman</span>
        <span className="flex items-center gap-6">
          <span>Tel Aviv, Israel</span>
          {/*
           * Quiet, and now actually legible.
           *
           * This was --clay at 20% alpha, which composites to 1.34:1 on
           * paper — not quiet, invisible, and a link nobody can see is a link
           * that fails a keyboard user and a screen magnifier equally. The
           * comment it carried already made the argument against hiding it:
           * the security here is the GitHub wall in front of the admin host,
           * not the obscurity of the link. --ink-soft at 6.37:1 keeps it the
           * least emphatic thing in the footer without making it a secret.
           */}
          <a
            href="https://admin.yehudabriskman.com/admin"
            className="-my-3 inline-flex min-h-11 items-center py-3 text-clay transition-colors hover:text-ink focus-visible:text-ink"
            aria-label="Admin"
          >
            admin
          </a>
        </span>
      </div>
    </footer>
  );
}
