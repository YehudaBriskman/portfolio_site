import { Link } from "react-router-dom";
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
 * THE GROUND IS DARK (#160), and it is chrome, not a third dark act.
 *
 * The page above ends on paper — the close "closes where the hero opened" —
 * and a paper footer under a paper close was one sheet with a hairline in it:
 * nothing said where the page stopped and the furniture began. So the footer
 * stands on `--panel`, edge to edge, with a straight top edge.
 *
 * `components/ground/DarkAct.tsx` sets a ceiling of two dark acts and argues
 * for it; the argument for why this is not a third is written there, beside
 * the ceiling, so that whoever reads the ceiling reads the exception with it.
 * In short: an act is a section of the page's argument and the ceiling counts
 * those; the footer is on every route, says nothing about the work, and gets
 * none of what makes an act an act — no arc, no seams, no drift, no head.
 *
 * `.on-panel` re-points every token and restates `color`, so the classes
 * below did not change and each one now resolves against #0C0C0E. MEASURED
 * against the ground, by the same formula `scripts/a11y` holds the floor to:
 *
 *   --ink (links, the copyright line)       #F2F0EA  17.15:1
 *   --clay (eyebrows, colophon, notes)      #A8A49A   7.86:1
 *   --sodium (hover)                        #7AA2E8   7.59:1
 *   --edge (the colophon's hairline)        #64646E   3.34:1
 *   focus ring (--bone)                     #F2F0EA  17.15:1
 *
 * Every text role clears 4.5:1 at 12px with room to spare, the smallest type
 * here is the 12px data line, and the hairline clears the 3:1 a visible
 * boundary is held to even though it is a separator and not a control.
 *
 * `data-chrome="dark"` is the contract `nav/useDarkChrome.ts` reads, so the
 * nav island goes dark when the footer passes under it, as it does over the
 * two acts — on a short route that is the moment it would otherwise be a
 * paper island on a dark ground.
 */
export default function SiteFooter() {
  /* --ink at 15.17:1 on paper. Was --bone/85, which is the same colour
     diluted for no reason now that the ground is light. */
  const linkRow =
    "-my-1 inline-flex min-h-11 items-center text-sm text-ink transition-colors hover:text-sodium sm:min-h-0 sm:py-1";

  return (
    <footer className="footer-ground on-panel" data-chrome="dark">
      {/* No drawn top rule any more: the change of ground is the edge, and a
          hairline drawn along a boundary that is already 15.95:1 says it
          twice. The footer has no motion at all, which is right for chrome. */}
      <div className="wrap pb-section-sm pt-16 sm:pt-20">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="eyebrow">Pages</p>
            {/* `space-y-1` and not the usual item gap: every row here already
                carries a 44px tap target, so the touch rhythm is the rhythm and
                anything on top of it only makes the footer taller. */}
            <ul className="mt-3 space-y-1">
              {[
                { to: "/", label: "Home" },
                { to: "/story", label: "Journey" },
                { to: "/projects", label: "Work" },
                { to: "/blog", label: "Blogs" },
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
             * The accessibility statement, on every page because the footer is
             * (#99). Same treatment and the same 44px target as the admin link
             * beside it: quiet, but a link a keyboard and a magnifier can find.
             */}
            <Link
              to="/accessibility"
              className="-my-3 inline-flex min-h-11 items-center py-3 text-clay transition-colors hover:text-ink focus-visible:text-ink"
            >
              accessibility
            </Link>
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
      </div>
    </footer>
  );
}
