import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronLeft, ExternalLink, LogOut, Menu, X } from "lucide-react";
import { admin } from "@/services/admin";
import { markAdminSeen } from "@/components/notes/reader/adminSession";
import DisplayMenu from "@/components/nav/DisplayMenu";
import { useAdminWords } from "@/i18n/admin";
import { useKeyboardOpen } from "./keyboard";
import { toDo, useTranslationReport } from "@/services/translations";
import { useAnnounceUnread } from "@/services/adminAnnounce";
import { SidebarNav } from "@/components/ui/SidebarGroup";
import { useMobileWords } from "@/i18n/mobile";
import { useMarketingWords } from "@/components/admin/announce/inbox/words";
import { useAudienceWords } from "@/components/admin/announce/audience/words";
import { useCampaignWords } from "@/components/admin/announce/campaigns/words";
import { useLibraryWords } from "@/components/admin/announce/library/words";
import { useSenderWords } from "@/components/admin/announce/sender/words";
import { buildNav, type AdminNavId } from "./adminNav";

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
  | "translations"
  | "marketing";
type Section = AdminSection;

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
  marketing: "/admin/marketing",
};

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
  const { pathname, search } = useLocation();
  const w = useAdminWords();
  const nw = useMobileWords().nav;
  const mk = useMarketingWords();
  const aw = useAudienceWords();
  const cw = useCampaignWords();
  const lw = useLibraryWords();
  const sw = useSenderWords();
  /* Public units a Hebrew reader gets in English or out of date (#302). */
  const { report: heReport } = useTranslationReport();
  const translationsDue = heReport ? toDo(heReport) : undefined;
  const announceUnread = useAnnounceUnread();
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
  const here = pathname + search;
  const [seenPath, setSeenPath] = useState(here);
  if (seenPath !== here) {
    setSeenPath(here);
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
  const keyboard = useKeyboardOpen();
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

  const tree = buildNav({
    label: (id: AdminNavId) => {
      switch (id) {
        case "marketing-inbox": return mk.tabInbox;
        case "marketing-audience": return aw.tab;
        case "marketing-campaigns": return cw.tab;
        case "marketing-library": return lw.tab;
        case "marketing-settings": return mk.tabSettings;
        case "marketing-sender": return sw.heading;
        case "g-content": return w.groups.content;
        case "g-media": return w.nav.media;
        case "g-site": return w.groups.site;
        case "g-system": return nw.system;
        default: return w.nav[id as Section];
      }
    },
    badge: (id: AdminNavId) => {
      /* Only unread ones: nothing waiting shows no badge at all. */
      if (id === "marketing" || id === "marketing-inbox") return announceUnread ? { n: announceUnread, label: w.announceUnread(announceUnread) } : undefined;
      if (id === "translations" || id === "g-site") return translationsDue ? { n: translationsDue, label: w.toDo(translationsDue) } : undefined;
      const n = counts?.[id as Section];
      return n === undefined ? undefined : { n };
    },
  });

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
          <SidebarNav nodes={tree} label={w.sections} storageKey="admin-nav-open" fallbackId={section} className="a-side-nav" />

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
        <div
          ref={bar}
          data-keyboard={keyboard || undefined}
          className={barEverywhere ? "a-bottom a-bottom-all" : "a-bottom lg:hidden"}
        >
          {bottomBar}
        </div>
      )}
    </div>
  );
}
