import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BookOpen,
  ChevronLeft,
  ExternalLink,
  FileText,
  FolderKanban,
  Image,
  Languages,
  LayoutDashboard,
  LogOut,
  Menu,
  Plug,
  Settings,
  Shapes,
  Type,
  X,
} from "lucide-react";
import { admin } from "@/services/admin";
import { markAdminSeen } from "@/components/notes/reader/adminSession";
import DisplayMenu from "@/components/nav/DisplayMenu";
import Ring from "@/components/motion/Ring";
import { useAdminWords } from "@/i18n/admin";
import { Counter } from "./ui";
import { toDo, useTranslationReport } from "@/services/translations";

/*
 * The admin's own shell, rebuilt as a tool (#288).
 *
 * GitHub's frame and the site's material: a compact top bar (the site's mark,
 * where you are, the way back to the site, the theme menu the public nav
 * uses, and who is signed in) over a left nav with icons and sentence-case
 * labels. The current item is circled with the living line's ring, as on the
 * public dashboards (#251), so it is visibly the same product.
 *
 * It still does not reuse PageShell or sit under `SiteChrome`: the public
 * nav's rooms are anchors to sections no admin page has, and its scenery
 * (Atmosphere, the grain) is decoration on an authoring tool, paid for by
 * the weakest device. The palette, the type, the ring and the theme menu
 * carry the family resemblance.
 *
 * Below `lg` the nav is a drawer behind the menu button, rather than the
 * eight-tab bottom bar it was: eight sections do not fit a phone's width at
 * a size anyone can read. The bottom of the screen belongs to an editor's
 * Save, as before.
 */

export type AdminSection =
  | "overview"
  | "posts"
  | "areas"
  | "projects"
  | "story"
  | "site-copy"
  | "media"
  | "settings"
  | "connections"
  | "translations";
type Section = AdminSection;

const ICONS: Record<Section, typeof FileText> = {
  overview: LayoutDashboard,
  posts: FileText,
  areas: Shapes,
  projects: FolderKanban,
  story: BookOpen,
  "site-copy": Type,
  media: Image,
  settings: Settings,
  connections: Plug,
  translations: Languages,
};

const PATHS: Record<Section, string> = {
  overview: "/admin",
  posts: "/admin/posts",
  areas: "/admin/areas",
  projects: "/admin/projects",
  story: "/admin/story",
  "site-copy": "/admin/site-copy",
  media: "/admin/media",
  settings: "/admin/settings",
  connections: "/admin/connections",
  translations: "/admin/translations",
};

const GROUPS: Array<{ id: "top" | "content" | "site"; items: Section[] }> = [
  { id: "top", items: ["overview"] },
  /* What the public site shows. */
  { id: "content", items: ["posts", "areas", "projects", "story", "site-copy", "media", "translations"] },
  /* How it shows it, and who else may read or write it. */
  { id: "site", items: ["settings", "connections"] },
];

const PUBLIC_SITE = "https://yehudabriskman.com";

export type AdminShellProps = {
  /** The last breadcrumb, and the mobile bar's title. */
  title: string;
  section: Section;
  /** Counts beside the nav items. Omitted entries simply show no count. */
  counts?: Partial<Record<Section, number>>;
  /**
   * On an editor, the bottom slot belongs to Save. Passing this pins the
   * given bar to the bottom of the screen on a phone, and turns the mobile
   * menu button into a back link.
   */
  bottomBar?: ReactNode;
  backTo?: string;
  /**
   * Keep the bottom bar at every width, not only on a phone (#288). An
   * editor's Save then has one home: fixed to the bottom of the screen,
   * beside the nav, with the page padded so nothing scrolls out from under it.
   */
  barEverywhere?: boolean;
  /** Right-hand side of the mobile top bar. */
  actions?: ReactNode;
  children: ReactNode;
};

export default function AdminShell({ title, section, counts, bottomBar, backTo, barEverywhere, actions, children }: AdminShellProps) {
  const { pathname } = useLocation();
  const w = useAdminWords();
  /* Public units a Hebrew reader gets in English or out of date (#302). */
  const { report: heReport } = useTranslationReport();
  const translationsDue = heReport ? toDo(heReport) : undefined;
  const [who, setWho] = useState("");
  const [open, setOpen] = useState(false);
  const drawerId = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    admin
      .me()
      .then((m) => {
        setWho(m.login);
        /* So a note read in this browser knows to offer "Edit" (#249). */
        markAdminSeen();
      })
      .catch(() => setWho(""));
  }, []);

  /* A route change closes the drawer: the link was the reason to open it.
     Set while rendering, not in an effect, so the closed drawer is the
     first frame of the new page rather than the second. */
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setOpen(false);
  }

  /* Open: focus moves in, Escape closes and hands focus back. */
  useEffect(() => {
    if (!open) return;
    drawer.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      toggle.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  /*
   * Focus not obscured (2.4.11, #99). The bottom bar is fixed, and on an
   * editor at 320px its buttons wrap to about 220px: a third of the screen.
   * The bar's measured height becomes the root's `scroll-padding-bottom`, so
   * focus stops above it, and `--a-bar-h`, which pads `main` so the last
   * control can scroll clear. On a desktop it is `display: none` and
   * measures 0. The top bar is sticky, so the root's scroll-padding-top
   * clears it the same way (index.css).
   */
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = bar.current;
    const root = document.documentElement;
    if (!el || typeof ResizeObserver === "undefined") return;
    const apply = () => {
      const h = el.getBoundingClientRect().height;
      root.style.scrollPaddingBottom = h ? `${Math.ceil(h) + 8}px` : "";
      root.style.setProperty("--a-bar-h", `${Math.ceil(h)}px`);
    };
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    apply();
    return () => {
      ro.disconnect();
      root.style.scrollPaddingBottom = "";
      root.style.removeProperty("--a-bar-h");
    };
  }, []);

  const sectionLabel = w.nav[section];
  const crumbs: Array<{ label: string; to?: string }> = [{ label: w.admin, to: "/admin" }];
  if (section !== "overview") crumbs.push({ label: sectionLabel, to: PATHS[section] });
  if (title !== sectionLabel && section !== "overview") crumbs.push({ label: title });
  /* The last crumb is the page you are on. */
  const last = crumbs.length - 1;

  return (
    <div className="a-app">
      <a href="#admin-content" className="a-skip">
        {w.skip}
      </a>

      <header className="a-top">
        {backTo ? (
          <Link to={backTo} className="a-btn a-btn-ghost a-icon-btn lg:hidden" aria-label={w.back}>
            <ChevronLeft aria-hidden="true" />
          </Link>
        ) : (
          <button
            ref={toggle}
            type="button"
            className="a-btn a-btn-ghost a-icon-btn lg:hidden"
            aria-expanded={open}
            aria-controls={drawerId}
            aria-label={open ? w.closeMenu : w.menu}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        )}

        <Link to="/admin" className="a-brand">
          <img src="/favicon.svg" alt="" width={28} height={28} className="a-brand-mark" />
          <span className="a-brand-name">Yehuda Briskman</span>
        </Link>

        <nav aria-label={w.breadcrumb} className="a-crumbs">
          <ol>
            {crumbs.map((c, i) => (
              <li key={`${c.label}-${i}`} data-last={i === last ? "" : undefined}>
                {c.to && i !== last ? (
                  <Link to={c.to}>{c.label}</Link>
                ) : (
                  <span aria-current="page">{c.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>

        <div className="a-top-end">
          {actions && <div className="flex items-center gap-1 lg:hidden">{actions}</div>}
          <a
            href={PUBLIC_SITE}
            target="_blank"
            rel="noreferrer noopener"
            className="a-btn a-btn-ghost a-top-link"
            aria-label={w.viewSiteNewTab}
          >
            <ExternalLink aria-hidden="true" />
            <span className="hidden md:inline">{w.viewSite}</span>
          </a>
          <DisplayMenu />
          {who && (
            <span className="a-owner" title={w.signedInAs(who)}>
              <span className="a-avatar" aria-hidden="true">
                {who.slice(0, 1).toUpperCase()}
              </span>
              <span className="sr-only">{w.signedInAs(who)}</span>
              <span className="hidden xl:inline" aria-hidden="true">
                {who}
              </span>
            </span>
          )}
        </div>
      </header>

      <div className="a-frame">
        <div className="a-scrim" hidden={!open} onClick={() => setOpen(false)} aria-hidden="true" />
        <div ref={drawer} id={drawerId} className="a-side" data-open={open ? "" : undefined}>
          <nav aria-label={w.sections} className="a-side-nav">
            {GROUPS.map((g) => (
              <div key={g.id} className="a-side-group">
                {g.id !== "top" && <p className="a-side-head">{w.groups[g.id]}</p>}
                <ul>
                  {g.items.map((id) => {
                    const Icon = ICONS[id];
                    const current = id === section;
                    return (
                      <li key={id}>
                        <Link to={PATHS[id]} aria-current={current ? "page" : undefined} className="a-nav-item">
                          <span className="a-nav-icon" aria-hidden="true">
                            {current ? (
                              <Ring size={26} draw={false}>
                                <Icon />
                              </Ring>
                            ) : (
                              <Icon />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">{w.nav[id]}</span>
                          {id === "translations" ? (
                            <span title={translationsDue === undefined ? undefined : w.toDo(translationsDue)}>
                              <span aria-hidden="true">
                                <Counter n={translationsDue} />
                              </span>
                              {translationsDue !== undefined && <span className="sr-only">{w.toDo(translationsDue)}</span>}
                            </span>
                          ) : (
                            <Counter n={counts?.[id]} />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          <div className="a-side-foot">
            <p className="a-side-who">{who ? w.signedInAs(who) : w.signedIn}</p>
            <a href="/oauth2/sign_out" className="a-nav-item">
              <span className="a-nav-icon" aria-hidden="true">
                <LogOut />
              </span>
              {w.signOut}
            </a>
          </div>
        </div>

        <main id="admin-content" tabIndex={-1} className="a-main">
          {children}
        </main>
      </div>

      {/* The one screen-bottom region: an editor's Save. */}
      {bottomBar && (
        <div ref={bar} className={barEverywhere ? "a-bottom a-bottom-all" : "a-bottom lg:hidden"}>
          {bottomBar}
        </div>
      )}
    </div>
  );
}
