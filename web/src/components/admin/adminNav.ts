import {
  Blocks,
  BookOpen,
  FileText,
  FolderKanban,
  Image,
  Inbox,
  Languages,
  LayoutDashboard,
  LayoutGrid,
  Library,
  Mail,
  Send,
  Settings,
  SlidersHorizontal,
  Type,
  Users,
  type LucideIcon,
} from "lucide-react";
import { iconOf } from "@/components/ui/Icon";
import { leafPaths, type NavNode } from "@/components/ui/SidebarGroup";

/*
 * The admin's navigation tree (#675).
 *
 * Order is the importance order of docs/admin-design-guide.md section 1.2,
 * scored F (how often) x C (cost of missing it) x U (how soon) x R
 * (irreversibility) for the owner's job "when I open the admin, I need to see
 * what waits on me and then change the site":
 *
 *   Overview   3x1x1x1 =  3   one tap from the brand mark too, so it sits first and costs one row
 *   Marketing  3x3x3x3 = 81   the Inbox holds what to post today; a send cannot be undone
 *   Content    3x2x1x2 = 12   edited every visit, mistakes cost rework
 *   Media      2x1x1x1 =  2   assets are found from the editors, not from here
 *   Site       1x2x1x2 =  4   copy, translations and settings change a few times a month
 *   System     1x3x1x2 =  6   connected apps: rare, but a wrong grant is a security matter
 *
 * Groups with the same score keep the order the old flat nav had. A group is
 * shut until the route is inside it, so the drawer shows six rows, not
 * twenty. Marketing's children are the hub's tabs, reached by the same
 * `?tab=` and `?section=` addresses the page already reads.
 */

export type AdminNavId =
  | "overview"
  | "marketing"
  | "marketing-inbox"
  | "marketing-audience"
  | "marketing-campaigns"
  | "marketing-library"
  | "marketing-settings"
  | "marketing-sender"
  | "g-content"
  | "posts"
  | "areas"
  | "projects"
  | "story"
  | "site-copy"
  | "g-media"
  | "media"
  | "g-site"
  | "translations"
  | "settings"
  | "g-system"
  | "connections";

type Leaf = { id: AdminNavId; to: string; icon?: LucideIcon };

/* Every nav glyph is drawn through ui/Icon (size 20, stroke 1.75). */
const I = {
  overview: iconOf(LayoutDashboard),
  marketing: iconOf(Mail),
  inbox: iconOf(Inbox),
  audience: iconOf(Users),
  campaigns: iconOf(Send),
  library: iconOf(Library),
  tune: iconOf(SlidersHorizontal),
  content: iconOf(FileText),
  areas: iconOf(LayoutGrid),
  projects: iconOf(FolderKanban),
  story: iconOf(BookOpen),
  copy: iconOf(Type),
  media: iconOf(Image),
  settings: iconOf(Settings),
  languages: iconOf(Languages),
  apps: iconOf(Blocks),
};

export const NAV_SHAPE: Array<Leaf & { children?: Array<Leaf & { children?: Leaf[] }> }> = [
  { id: "overview", to: "/admin", icon: I.overview },
  {
    id: "marketing",
    to: "/admin/marketing",
    icon: I.marketing,
    children: [
      { id: "marketing-inbox", to: "/admin/marketing", icon: I.inbox },
      { id: "marketing-audience", to: "/admin/marketing?tab=audience", icon: I.audience },
      { id: "marketing-campaigns", to: "/admin/marketing?tab=campaigns", icon: I.campaigns },
      { id: "marketing-library", to: "/admin/marketing?tab=library", icon: I.library },
      {
        id: "marketing-settings",
        to: "/admin/marketing?tab=settings",
        icon: I.tune,
        children: [{ id: "marketing-sender", to: "/admin/marketing?tab=settings&section=sender" }],
      },
    ],
  },
  {
    id: "g-content",
    to: "",
    icon: I.content,
    children: [
      { id: "posts", to: "/admin/posts", icon: I.content },
      { id: "areas", to: "/admin/areas", icon: I.areas },
      { id: "projects", to: "/admin/projects", icon: I.projects },
      { id: "story", to: "/admin/story", icon: I.story },
      { id: "site-copy", to: "/admin/site-copy", icon: I.copy },
    ],
  },
  { id: "g-media", to: "", icon: I.media, children: [{ id: "media", to: "/admin/media", icon: I.media }] },
  {
    id: "g-site",
    to: "",
    icon: I.settings,
    children: [
      { id: "translations", to: "/admin/translations", icon: I.languages },
      { id: "settings", to: "/admin/settings", icon: I.settings },
    ],
  },
  { id: "g-system", to: "", icon: I.apps, children: [{ id: "connections", to: "/admin/connections", icon: I.apps }] },
];

export type NavText = {
  label: (id: AdminNavId) => string;
  /** Count (and its words) beside a node; omitted means no badge. */
  badge: (id: AdminNavId) => { n?: number; label?: string } | undefined;
};

export function buildNav(t: NavText): NavNode[] {
  const make = (s: Leaf & { children?: Leaf[] }): NavNode => {
    const b = t.badge(s.id);
    return {
      id: s.id,
      label: t.label(s.id),
      icon: s.icon,
      to: s.to || undefined,
      badge: b?.n,
      badgeLabel: b?.label,
      children: s.children?.map((c) => make(c as Leaf & { children?: Leaf[] })),
    };
  };
  return NAV_SHAPE.map(make);
}

/** Every pathname a leaf links to; the nav test checks each is a route in App.tsx. */
export const ADMIN_NAV_TARGETS: string[] = [
  ...new Set(
    leafPaths(
      buildNav({
        label: (id) => id,
        badge: () => undefined,
      }),
    ),
  ),
];
