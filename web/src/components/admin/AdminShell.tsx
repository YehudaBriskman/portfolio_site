import { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, ExternalLink, FilePlus, FolderPlus, ImagePlus, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Search, X } from "lucide-react";
import { admin } from "@/services/admin";
import { markAdminSeen } from "@/components/notes/reader/adminSession";
import DisplayMenu, { DisplayPanel } from "@/components/nav/DisplayMenu";
import { DisclosureButton } from "@/components/ui/Disclosure";
import { Icon, iconOf } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useChromeWords } from "@/i18n/chrome";
import NotificationsMenu from "@/components/admin/NotificationsMenu";
import { toast } from "@/lib/toast";
import { useAdminWords } from "@/i18n/admin";
import { modLabel, useKeyboardOpen, useShortcut } from "./keyboard";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { flattenNav, type PaletteItem } from "@/components/ui/paletteItems";
import { useCommandWords } from "./commandWords";
import { toDo, useTranslationReport } from "@/services/translations";
import { useAnnounceUnread } from "@/services/adminAnnounce";
import { SidebarNav } from "@/components/ui/SidebarGroup";
import { useMobileWords } from "@/i18n/mobile";
import { useMarketingWords } from "@/components/admin/announce/inbox/words";
import { useAudienceWords } from "@/components/admin/announce/audience/words";
import { useCampaignWords } from "@/components/admin/announce/campaigns/words";
import { useLibraryWords } from "@/components/admin/announce/library/words";
import { useSenderWords } from "@/components/admin/announce/sender/words";
import { useSettingsPanelWords } from "@/components/admin/announce/settingsWords";
import { useSignatureWords } from "@/components/admin/announce/signature/words";
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
  /** A phone screen with no header of its own: the bar's page title is the one visible h1 (A2). */
  titleH1?: boolean;
  children: ReactNode;
};

/* The sidebar's collapse to an icon rail (#809): one key, "1" when collapsed. */
const COLLAPSE_KEY = "admin-nav-collapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(next: boolean) {
  try {
    localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
  } catch {
    /* blocked storage: the rail still works, it just forgets */
  }
}

type GlyphProps = { className?: string; "aria-hidden"?: boolean | "true" };
const CollapseGlyph = (p: GlyphProps) => <Icon icon={PanelLeftClose} mirrorInRtl {...p} />;
const ExpandGlyph = (p: GlyphProps) => <Icon icon={PanelLeftOpen} mirrorInRtl {...p} />;

const SearchGlyph = (p: GlyphProps) => <Icon icon={Search} {...p} />;
const CREATE_ICON = { post: iconOf(FilePlus), area: iconOf(FolderPlus), upload: iconOf(ImagePlus) };

/* The width at which the drawer becomes the permanent sidebar (index.css `.a-side`). */
const DRAWER_QUERY = "(min-width: 1024px)";

/** True once the sidebar is always on screen, so the drawer and its toggle no longer exist. */
function useSidebarDocked(): boolean {
  return useSyncExternalStore(
    (cb) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
      const mq = window.matchMedia(DRAWER_QUERY);
      mq.addEventListener?.("change", cb);
      return () => mq.removeEventListener?.("change", cb);
    },
    () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(DRAWER_QUERY).matches,
    () => false,
  );
}

/*
 * One shell for the whole admin (#852). The shell used to be rendered inside each page, so a route change
 * unmounted the sidebar and its scroll container came back at the top. Now `AdminLayout` (a layout route)
 * mounts the frame once; a page still writes `<AdminShell title section ...>content</AdminShell>`, which
 * publishes those props to the frame and renders only its content, into the frame's <main>. Outside a
 * layout (a test, a story) it renders the whole frame itself, as before.
 */
export type ShellProps = Omit<AdminShellProps, "children">;

export type ShellSlot = { publish: (next: ShellProps | ((cur: ShellProps | null) => ShellProps | null)) => void };
export const ShellSlotContext = createContext<ShellSlot | null>(null);

const sameCounts = (a: ShellProps["counts"], b: ShellProps["counts"]) => {
  const ka = Object.keys(a ?? {});
  const kb = Object.keys(b ?? {});
  return ka.length === kb.length && ka.every((k) => (a as Record<string, number | undefined>)[k] === (b as Record<string, number | undefined>)?.[k]);
};

export default function AdminShell({ children, ...props }: AdminShellProps) {
  const slot = useContext(ShellSlotContext);
  const publish = slot?.publish;
  const { title, section, counts, bottomBar, backTo, barEverywhere, actions, titleH1 } = props;
  useLayoutEffect(() => {
    publish?.((cur) =>
      cur && cur.title === title && cur.section === section && cur.bottomBar === bottomBar && cur.backTo === backTo && cur.barEverywhere === barEverywhere && cur.actions === actions && cur.titleH1 === titleH1 && sameCounts(cur.counts, counts)
        ? cur
        : { title, section, counts, bottomBar, backTo, barEverywhere, actions, titleH1 },
    );
  });
  /* The next page publishes its own; until it does (a chunk still loading) keep the title and drop what belongs to a screen's own controls. */
  useLayoutEffect(
    () => () => publish?.((cur) => (cur ? { ...cur, bottomBar: undefined, backTo: undefined, barEverywhere: undefined, actions: undefined, titleH1: undefined } : cur)),
    [publish],
  );
  if (slot) return <>{children}</>;
  return <ShellFrame {...props}>{children}</ShellFrame>;
}

export function ShellFrame({ title, section, counts, bottomBar, backTo, barEverywhere, actions, titleH1, children }: AdminShellProps) {
  const { pathname, search } = useLocation();
  const w = useAdminWords();
  const mobile = useMobileWords();
  const nw = mobile.nav;
  const cmd = useCommandWords();
  const navigate = useNavigate();
  const chrome = useChromeWords();
  const mk = useMarketingWords();
  const aw = useAudienceWords();
  const cw = useCampaignWords();
  const lw = useLibraryWords();
  const sw = useSenderWords();
  const stw = useSettingsPanelWords();
  const sigw = useSignatureWords();
  /* Public units a Hebrew reader gets in English or out of date (#302). */
  const { report: heReport } = useTranslationReport();
  const translationsDue = heReport ? toDo(heReport) : undefined;
  const announceUnread = useAnnounceUnread();
  const [who, setWho] = useState("");
  const [open, setOpen] = useState(false);
  const [displayOpen, setDisplayOpen] = useState(false);
  const [collapsedPref, setCollapsedPref] = useState(readCollapsed);
  const [accountOpen, setAccountOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  /* Widening past the drawer breakpoint (rotate, resize, snap) hides the toggle
     that could close it, so a drawer left open would leave <main> inert with no
     control to undo it. Close it at that moment, while rendering like the route
     change below, and read "open" through the width so it can never be stale. */
  const docked = useSidebarDocked();
  if (docked && open) setOpen(false);
  const drawerOpen = open && !docked;
  /* The rail is a desktop state: the drawer is always the full tree, whatever was saved. */
  const rail = docked && collapsedPref;
  const setCollapsed = (next: boolean) => {
    setCollapsedPref(next);
    writeCollapsed(next);
  };
  const drawerId = useId();
  const displayId = useId();
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

  /* The shortcut registry (keyboard.ts) holds both keys, so they cannot collide:
     Ctrl/Cmd+B folds the sidebar (not inside a field, where it is bold), and
     Ctrl/Cmd+K opens the palette (live in a plain field, not in a rich-text
     one, where it is a link). */
  useShortcut({
    id: "admin-sidebar",
    key: "b",
    mod: true,
    fields: "none",
    enabled: () => docked,
    run: () =>
      setCollapsedPref((v) => {
        writeCollapsed(!v);
        return !v;
      }),
  });
  useShortcut({ id: "admin-palette", key: "k", mod: true, fields: "plain", run: () => setPaletteOpen((v) => !v) });

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
  /* The bar arrives with a page now (the frame outlives pages), so the observer follows whether there is one. */
  const hasBar = Boolean(bottomBar);
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
  }, [hasBar]);

  const tree = buildNav({
    label: (id: AdminNavId) => {
      switch (id) {
        case "marketing-inbox": return mk.tabInbox;
        case "marketing-audience": return aw.tab;
        case "marketing-campaigns": return cw.tab;
        case "marketing-library": return lw.tab;
        case "marketing-settings": return mk.tabSettings;
        case "marketing-sender": return sw.heading;
        /* The Settings screen's own section titles (SettingsPhone's groups), so the sidebar adds no wording. */
        case "marketing-settings-mail": return stw.gMail;
        case "marketing-settings-channels": return stw.gChannels;
        case "marketing-settings-wording": return stw.gWording;
        case "marketing-settings-signature": return sigw.groupTitle;
        case "marketing-settings-limits": return stw.gLimits;
        case "marketing-settings-texts": return stw.gTexts;
        case "marketing-settings-notices": return stw.gNotices;
        case "marketing-settings-advanced": return stw.advancedHeading;
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

  /* The palette: the create actions, then every page the nav holds. */
  const paletteItems: PaletteItem[] = [
    { id: "new-post", label: w.newNote, group: "create", icon: CREATE_ICON.post, run: () => navigate("/admin/posts/new") },
    { id: "new-area", label: w.newArea, group: "create", icon: CREATE_ICON.area, run: () => navigate("/admin/areas/new") },
    { id: "upload-media", label: w.upload, group: "create", icon: CREATE_ICON.upload, run: () => navigate("/admin/media") },
    ...flattenNav(tree, (to) => navigate(to)),
  ];

  const sectionLabel = w.nav[section];
  const crumbs: Array<{ label: string; to?: string }> = [{ label: w.admin, to: "/admin" }];
  if (section !== "overview") crumbs.push({ label: sectionLabel, to: PATHS[section] });
  if (title !== sectionLabel && section !== "overview") crumbs.push({ label: title });
  /* The last crumb is the page you are on. */
  const last = crumbs.length - 1;

  return (
    <div className="a-app" data-side={rail ? "rail" : "full"}>
      <a href="#admin-content" className="a-skip">
        {w.skip}
      </a>

      <header className="a-top">
        {backTo && (
          <Link to={backTo} className="a-btn a-btn-ghost lg:hidden a-top-word" aria-label={w.back}>
            <ChevronLeft aria-hidden="true" className="a-mirror" />
            <span aria-hidden="true">{w.back}</span>
          </Link>
        )}
        {/* On a phone the bar is this button and the page title: the site link, display
            settings and the account are rows in the menu it opens (declutter). The
            button says "Menu" in words, not a bare glyph. */}
        <button
          ref={toggle}
          type="button"
          className="a-btn a-btn-ghost a-top-word lg:hidden"
          aria-expanded={open}
          aria-controls={drawerId}
          aria-label={open ? w.closeMenu : w.menu}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          <span aria-hidden="true">{open ? w.closeMenu : w.menu}</span>
        </button>

        {/* The favicon alone: who is signed in is said once, by the account menu. */}
        <Link to="/admin" className="a-brand max-lg:hidden" aria-label="Yehuda Briskman">
          <img src="/favicon.svg" alt="" width={28} height={28} className="a-brand-mark" />
        </Link>

        <nav aria-label={w.breadcrumb} className="a-crumbs">
          <ol>
            {crumbs.map((c, i) => (
              <li key={`${c.label}-${i}`} data-last={i === last ? "" : undefined}>
                {c.to && i !== last ? (
                  <Link to={c.to}><bdi>{c.label}</bdi></Link>
                ) : (
                  <span aria-current="page">{titleH1 ? <h1 className="a-crumb-h1"><bdi>{c.label}</bdi></h1> : <bdi>{c.label}</bdi>}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>

        <div className="a-top-end">
          {actions && <div className="flex items-center gap-1 lg:hidden">{actions}</div>}
          {/* On a phone the bell lives in the drawer: the top bar is on a control budget. */}
          <span className="contents max-lg:hidden">
            <IconButton
              icon={SearchGlyph}
              label={w.search}
              aria-haspopup="dialog"
              aria-keyshortcuts="Control+K Meta+K"
              onClick={() => setPaletteOpen(true)}
            />
          </span>
          <NotificationsMenu className="max-lg:hidden" />
          <span className="contents max-lg:hidden"><DisplayMenu /></span>
          {who && (
            <Popover open={accountOpen} onOpenChange={setAccountOpen}>
              <PopoverTrigger asChild>
                <button type="button" className="a-avatar max-lg:hidden" aria-label={w.signedInAs(who)} title={w.signedInAs(who)}>
                  {who.slice(0, 1).toUpperCase()}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="a-account w-64 max-w-[calc(100vw-1.5rem)] p-2">
                <p className="a-account-who" dir="ltr">
                  {who}
                </p>
                <a href={PUBLIC_SITE} target="_blank" rel="noreferrer noopener" className="a-nav-item" aria-label={w.viewSiteNewTab}>
                  <span className="a-nav-icon" aria-hidden="true">
                    <ExternalLink />
                  </span>
                  {w.viewSite}
                </a>
                <a href="/oauth2/sign_out" className="a-nav-item" onClick={() => toast.clearHistory()}>
                  <span className="a-nav-icon" aria-hidden="true">
                    <LogOut />
                  </span>
                  {w.signOut}
                </a>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </header>

      <div className="a-frame">
        <div className="a-scrim" hidden={!open} onClick={() => setOpen(false)} aria-hidden="true" />
        <div ref={drawer} id={drawerId} className="a-side" data-open={open ? "" : undefined}>
          <SidebarNav
            nodes={tree}
            label={w.sections}
            storageKey="admin-nav-open"
            fallbackId={section}
            className="a-side-nav"
            collapsed={rail}
            onNavigate={() => setOpen(false)}
          />

          {docked && (
            <div className="a-side-collapse">
              <IconButton
                icon={rail ? ExpandGlyph : CollapseGlyph}
                label={rail ? w.expandSidebar : w.collapseSidebar}
                aria-expanded={!rail}
                aria-controls={drawerId}
                onClick={() => setCollapsed(!rail)}
              />
            </div>
          )}

          {!docked && (
          <div className="a-side-foot">
            <div className="lg:hidden">
              <button
                type="button"
                className="a-nav-item"
                aria-haspopup="dialog"
                onClick={() => {
                  setOpen(false);
                  setPaletteOpen(true);
                }}
              >
                <span className="a-nav-icon" aria-hidden="true">
                  <Search />
                </span>
                {w.search}
              </button>
              <NotificationsMenu withLabel />
              <a href={PUBLIC_SITE} target="_blank" rel="noreferrer noopener" className="a-nav-item" aria-label={w.viewSiteNewTab}>
                <span className="a-nav-icon" aria-hidden="true">
                  <ExternalLink />
                </span>
                {w.viewSite}
              </a>
              <DisclosureButton expanded={displayOpen} controls={displayId} onToggle={() => setDisplayOpen((v) => !v)}>
                {chrome.displaySettings}
              </DisclosureButton>
              <div id={displayId} hidden={!displayOpen}>
                {displayOpen && <DisplayPanel inline />}
              </div>
            </div>
            <p className="a-side-who">{who ? w.signedInAs(who) : w.signedIn}</p>
            <a href="/oauth2/sign_out" className="a-nav-item" onClick={() => toast.clearHistory()}>
              <span className="a-nav-icon" aria-hidden="true">
                <LogOut />
              </span>
              {w.signOut}
            </a>
          </div>
          )}
        </div>

        <main id="admin-content" tabIndex={-1} className="a-main" inert={drawerOpen || undefined}>
          {children}
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        items={paletteItems}
        words={{ title: w.search, placeholder: cmd.placeholder, recent: cmd.recent, create: cmd.create, go: cmd.go, empty: cmd.empty, results: cmd.results, close: mobile.sheet.close }}
      />

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
