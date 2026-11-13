import {
  BookOpen,
  FileText,
  FolderKanban,
  Image,
  Inbox,
  Languages,
  LayoutDashboard,
  Library,
  Megaphone,
  Plug,
  Send,
  Settings,
  Shapes,
  SlidersHorizontal,
  Type,
  Users,
  type LucideIcon,
} from "lucide-react";
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

export const NAV_SHAPE: Array<Leaf & { children?: Array<Leaf & { children?: Leaf[] }> }> = [
  { id: "overview", to: "/admin", icon: LayoutDashboard },
  {
    id: "marketing",
    to: "/admin/marketing",
    icon: Megaphone,
    children: [
      { id: "marketing-inbox", to: "/admin/marketing", icon: Inbox },
      { id: "marketing-audience", to: "/admin/marketing?tab=audience", icon: Users },
      { id: "marketing-campaigns", to: "/admin/marketing?tab=campaigns", icon: Send },
      { id: "marketing-library", to: "/admin/marketing?tab=library", icon: Library },
      {
        id: "marketing-settings",
        to: "/admin/marketing?tab=settings",
        icon: SlidersHorizontal,
        children: [{ id: "marketing-sender", to: "/admin/marketing?tab=settings&section=sender" }],
      },
    ],
  },
  {
    id: "g-content",
    to: "",
    icon: FileText,
    children: [
      { id: "posts", to: "/admin/posts", icon: FileText },
      { id: "areas", to: "/admin/areas", icon: Shapes },
      { id: "projects", to: "/admin/projects", icon: FolderKanban },
      { id: "story", to: "/admin/story", icon: BookOpen },
      { id: "site-copy", to: "/admin/site-copy", icon: Type },
    ],
  },
  { id: "g-media", to: "", icon: Image, children: [{ id: "media", to: "/admin/media", icon: Image }] },
  {
    id: "g-site",
    to: "",
    icon: Settings,
    children: [
      { id: "translations", to: "/admin/translations", icon: Languages },
      { id: "settings", to: "/admin/settings", icon: Settings },
    ],
  },
  { id: "g-system", to: "", icon: Plug, children: [{ id: "connections", to: "/admin/connections", icon: Plug }] },
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
