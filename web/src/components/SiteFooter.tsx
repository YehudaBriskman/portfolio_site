import { Link } from "react-router-dom";
import { links } from "@/data/links";
import { contact } from "@/data/site";

/*
 * The site footer.
 *
 * It used to live inside the contact section, which meant it existed on the
 * home page and nowhere else — the email address, the profiles, the colophon
 * and the links back into the site were all missing from every project page and
 * every post, which are exactly the pages someone arrives on from a search.
 */
export default function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-edge pt-10">
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="eyebrow">Pages</p>
          <ul className="mt-4 space-y-1">
            {[
              { to: "/", label: "Home" },
              { to: "/projects", label: "Projects" },
              { to: "/blog", label: "Notes" },
            ].map((l) => (
              <li key={l.to}>
                {/* Route change, not a page load: an anchor here re-downloaded
                    and re-booted the whole bundle. */}
                <Link
                  to={l.to}
                  className="-my-1 inline-flex min-h-11 items-center text-sm text-bone/85 transition-colors hover:text-bone sm:min-h-0 sm:py-1"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="eyebrow">Work</p>
          <ul className="mt-4 space-y-1">
            {[
              { href: "https://windom.app", label: "WindoM", note: "Chrome Web Store" },
              { href: "https://github.com/YehudaBriskman/Bothy", label: "Bothy", note: "Self-hosted" },
            ].map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="-my-1 inline-flex min-h-11 items-center gap-2 text-sm text-bone/85 transition-colors hover:text-bone sm:min-h-0 sm:py-1"
                >
                  {l.label}
                  <span className="mono text-xs text-clay">{l.note}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="eyebrow">Elsewhere</p>
          <ul className="mt-4 space-y-1">
            {links.map((l) => (
              <li key={l.name}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="-my-1 inline-flex min-h-11 items-center text-sm capitalize text-bone/85 transition-colors hover:text-bone sm:min-h-0 sm:py-1"
                >
                  {l.name} <span aria-hidden="true" className="ml-1 text-clay">&#8599;</span>
                </a>
              </li>
            ))}
            <li>
              <a
                href={`mailto:${contact.email}`}
                className="-my-1 inline-flex min-h-11 items-center text-sm text-bone/85 transition-colors hover:text-bone sm:min-h-0 sm:py-1"
              >
                Email
              </a>
            </li>
          </ul>
        </div>

        <div>
          <p className="eyebrow">Colophon</p>
          {/* Every claim here is checkable, which is the point of the page. */}
          <p className="mt-4 text-sm leading-relaxed text-bone/70">
            Built with React and TypeScript. Runs on a single Arm machine I administer
            myself, behind Traefik and cert-manager, with the content in CouchDB.
          </p>
          <p className="mono mt-3 text-xs text-clay">
            No trackers. No cookie banner, because there are no cookies.
          </p>
        </div>
      </div>

      <div className="mono mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-edge pt-6 text-xs text-clay">
        <span>&copy; {new Date().getFullYear()} Yehuda Briskman</span>
        <span className="flex items-center gap-5">
          <span>Tel Aviv, Israel</span>
          {/* Deliberately quiet rather than hidden. The security here is the
              GitHub wall in front of the admin host, not the obscurity of the
              link — pretending otherwise would be the weaker of the two. */}
          <a
            href="https://admin.yehudabriskman.com/admin"
            className="-my-3 inline-flex min-h-11 items-center py-3 text-clay/20 transition-colors hover:text-bone focus-visible:text-bone"
            aria-label="Admin"
          >
            admin
          </a>
        </span>
      </div>
    </footer>
  );
}
