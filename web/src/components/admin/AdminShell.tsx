import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { admin } from "@/services/admin";

/*
 * The admin's own shell.
 *
 * It deliberately does not reuse PageShell, nor sit under `SiteChrome`, the
 * layout route that has mounted the public Nav since #63 (PageShell did before
 * that). The public Nav was, when this was written,
 * whose links are Work / Approach / Stack / Contact, anchors to sections that
 * exist on no admin page — so every link in the admin navbar quietly navigated
 * out of the admin, and on a phone it showed two links to the marketing site
 * and nothing else. It also mounts Atmosphere and the grain overlay: decorative
 * scenery on an authoring tool, paid for by the weakest device, and its scrim
 * lightens the right-hand side exactly where a form's second column sits.
 *
 * Here the palette and the type carry the family resemblance. The landscape
 * stays on the public site.
 */

export type AdminSection = "posts" | "areas" | "projects" | "story" | "site-copy" | "media" | "connections";
type Section = AdminSection;

const SECTIONS: Array<{ id: Section; to: string; label: string }> = [
  { id: "posts", to: "/admin/posts", label: "Posts" },
  { id: "areas", to: "/admin/areas", label: "Areas" },
  /* The site's own content (#163). */
  { id: "projects", to: "/admin/projects", label: "Projects" },
  { id: "story", to: "/admin/story", label: "Story" },
  { id: "site-copy", to: "/admin/site-copy", label: "Site copy" },
  /* The media library (#253). */
  { id: "media", to: "/admin/media", label: "Media" },
  { id: "connections", to: "/admin/connections", label: "Connected apps" },
];

const PUBLIC_SITE = "https://yehudabriskman.com";

export type AdminShellProps = {
  /** Shown in the mobile bar, and as the page heading when `heading` is unset. */
  title: string;
  section: Section;
  /** Counts beside the rail items. Omitted entries simply show no count. */
  counts?: Partial<Record<Section, number>>;
  /**
   * On an editor, the bottom slot belongs to Save — not to navigation one
   * thumb-slip away from discarding unsaved work. Passing this swaps the tab
   * bar for the given bar and turns the mobile title into a back link.
   */
  bottomBar?: ReactNode;
  backTo?: string;
  /** Right-hand side of the mobile top bar. */
  actions?: ReactNode;
  children: ReactNode;
};

export default function AdminShell({
  title,
  section,
  counts,
  bottomBar,
  backTo,
  actions,
  children,
}: AdminShellProps) {
  const { pathname } = useLocation();
  const [who, setWho] = useState("");

  useEffect(() => {
    admin
      .me()
      .then((m) => setWho(m.login))
      .catch(() => setWho(""));
  }, []);

  // Inference widens the literal to `string`, which aria-current does not accept.
  const isCurrent = (id: Section): "page" | undefined => (id === section ? "page" : undefined);

  return (
    <div className="min-h-dvh bg-bitumen text-bone lg:flex">
      <a
        href="#admin-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:bg-sodium focus:px-4 focus:py-2 focus:text-bitumen"
      >
        Skip to content
      </a>

      {/* Desktop: a rail, not a top bar. The editor is a vertical document, so
          vertical pixels are the scarce resource; horizontal space is what a
          wide screen has spare. It also grows to more sections without
          re-solving the layout, which a top bar does not. */}
      <aside className="a-bar hidden shrink-0 border-r lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-60 lg:flex-col lg:px-4 lg:py-5">
        <Link to="/admin/posts" className="mono px-3 text-xs uppercase tracking-[0.22em] text-bone">
          Y.B<span className="text-sodium">.</span>
          <span className="ml-2 text-[0.625rem] tracking-[0.22em] text-clay">admin</span>
        </Link>

        <nav className="mt-8 space-y-1" aria-label="Admin sections">
          {SECTIONS.map((s) => (
            <Link key={s.id} to={s.to} aria-current={isCurrent(s.id)} className="a-rail-item">
              <span>{s.label}</span>
              {counts?.[s.id] !== undefined && (
                <span className="tabular-nums text-clay">{counts[s.id]}</span>
              )}
            </Link>
          ))}
        </nav>

        <div className="mt-auto space-y-3 px-3 pt-6">
          <a
            href={PUBLIC_SITE}
            target="_blank"
            rel="noreferrer noopener"
            className="mono block text-[0.6875rem] uppercase tracking-[0.16em] text-clay transition-colors hover:text-bone"
          >
            View public site ↗
          </a>
          <p className="mono text-[0.625rem] leading-relaxed tracking-[0.12em] text-clay">
            {who ? `Signed in as ${who}` : "Signed in"}
          </p>
          <a
            href="/oauth2/sign_out"
            className="mono block text-[0.625rem] uppercase tracking-[0.16em] text-clay transition-colors hover:text-bone"
          >
            Sign out
          </a>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Mobile top bar. */}
        <header className="a-bar sticky top-0 z-30 flex h-14 items-center gap-1 border-b px-2 lg:hidden">
          {backTo ? (
            <Link
              to={backTo}
              className="a-btn a-btn-ghost a-icon-btn shrink-0"
              aria-label="Back"
            >
              <span aria-hidden="true">‹</span>
            </Link>
          ) : (
            <span className="mono px-3 text-xs uppercase tracking-[0.22em] text-bone">
              Y.B<span className="text-sodium">.</span>
            </span>
          )}
          <span className="mono min-w-0 flex-1 truncate px-1 text-[0.6875rem] uppercase tracking-[0.18em] text-clay">
            {title}
          </span>
          {actions}
        </header>

        <main id="admin-content" className="px-4 pb-32 pt-4 lg:px-10 lg:pb-16 lg:pt-8">
          {children}
        </main>
      </div>

      {/*
        One screen-bottom region, never two competing ones. On a list there is
        nothing to save, so the space belongs to navigation — and a thumb
        reaches the bottom of a phone, which a top bar never is. On an editor it
        belongs to Save.
      */}
      <div className="a-bar fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] lg:hidden">
        {bottomBar ?? (
          <nav className="flex" aria-label="Admin sections">
            {SECTIONS.map((s) => (
              <Link
                key={s.id}
                to={s.to}
                aria-current={isCurrent(s.id)}
                className={`mono flex min-h-[56px] flex-1 items-center justify-center text-[0.625rem] uppercase tracking-[0.16em] transition-colors ${
                  pathname.startsWith(s.to) ? "text-sodium" : "text-clay"
                }`}
              >
                {s.label}
              </Link>
            ))}
            <a
              href={PUBLIC_SITE}
              target="_blank"
              rel="noreferrer noopener"
              className="mono flex min-h-[56px] flex-1 items-center justify-center text-[0.625rem] uppercase tracking-[0.16em] text-clay"
            >
              Site ↗
            </a>
          </nav>
        )}
      </div>
    </div>
  );
}
