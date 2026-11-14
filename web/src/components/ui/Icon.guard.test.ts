import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * New code reaches lucide-react through `ui/Icon` (size 16/20/24, one stroke
 * per size). Files below imported lucide directly before the wrapper existed;
 * migrate one and delete its line. The list may only shrink.
 */
const LEGACY = new Set<string>([
  "src/components/admin/adminNav.ts",
  "src/components/admin/AdminShell.tsx",
  "src/components/admin/announce/audience/AudiencePhone.tsx",
  "src/components/admin/announce/audience/sourceIcon.ts",
  "src/components/admin/announce/campaigns/CampaignEditor.tsx",
  "src/components/admin/announce/EventCard.tsx",
  "src/components/admin/announce/inbox/Chips.tsx",
  "src/components/admin/announce/inbox/Composer.tsx",
  "src/components/admin/announce/inbox/InboxRow.tsx",
  "src/components/admin/announce/inbox/InboxTab.tsx",
  "src/components/admin/announce/library/LibraryPhone.tsx",
  "src/components/admin/announce/library/VisitorTemplates.tsx",
  "src/components/admin/announce/LinkPreview.tsx",
  "src/components/admin/content/EditorFrame.tsx",
  "src/components/admin/content/Fields.tsx",
  "src/components/admin/content/GroupSearch.tsx",
  "src/components/admin/content/Reorder.tsx",
  "src/components/admin/EditorBar.tsx",
  "src/components/admin/MediaPhone.tsx",
  "src/components/admin/noteEditor/BodyEditor.tsx",
  "src/components/admin/NotificationsMenu.tsx",
  "src/components/admin/overview/OverviewPhone.tsx",
  "src/components/BackChip.tsx",
  "src/components/city/ContributionCity.tsx",
  "src/components/dashboard/AskBox.tsx",
  "src/components/dashboard/History.tsx",
  "src/components/dashboard/Parts.tsx",
  "src/components/dashboard/Timeline.tsx",
  "src/components/nav/DisplayMenu.tsx",
  "src/components/notes/headingAnchors.tsx",
  "src/components/notes/NoteCard.tsx",
  "src/components/notes/reader/Lightbox.tsx",
  "src/components/notes/reader/NoteMarkdown.tsx",
  "src/components/notes/reader/NotePanels.tsx",
  "src/components/notes/ReadingBar.tsx",
  "src/components/phone/Chevron.tsx",
  "src/components/share/ShareMenu.tsx",
  "src/components/ui/BottomSheet.tsx",
  "src/components/ui/ChannelIcon.tsx",
  "src/components/ui/Disclosure.tsx",
  "src/components/ui/dropdown-menu.tsx",
  "src/components/ui/FilterChips.tsx",
  "src/components/ui/FilterSheet.tsx",
  "src/components/ui/Gauge.tsx",
  "src/components/ui/InfoPopover.tsx",
  "src/components/ui/Journey.tsx",
  "src/components/ui/RecordRow.tsx",
  "src/components/ui/SelectionBar.tsx",
  "src/components/ui/Select.tsx",
  "src/components/ui/SettingsList.tsx",
  "src/components/ui/SettingsRow.tsx",
  "src/components/ui/SettingsSearch.tsx",
  "src/components/ui/SidebarGroup.tsx",
  "src/components/ui/StatusGlyph.tsx",
  "src/components/work/RepoCard.tsx",
  "src/pages/AdminAreas.tsx",
  "src/pages/AdminEditor.tsx",
  "src/pages/AdminOverview.tsx",
  "src/pages/AdminProjects.tsx",
  "src/pages/Admin.tsx",
  "src/pages/BlogArea.tsx",
  "src/pages/BlogLog.tsx",
  "src/pages/BlogPost.tsx",
  "src/pages/Blog.tsx",
  "src/pages/Help.tsx",
  "src/pages/Privacy.tsx",
  "src/pages/Projects.tsx",
  "src/pages/Project.tsx",
]);

/* The wrapper itself, and the concept map that feeds it. */
const ALWAYS = new Set<string>(["src/components/ui/Icon.tsx", "src/components/ui/icons.ts"]);

const WEB = resolve(__dirname, "../../..");
const walk = (d: string): string[] =>
  readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

describe("lucide-react imports go through ui/Icon", () => {
  const files = walk(join(WEB, "src"))
    .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f))
    .map((f) => relative(WEB, f).split("\\").join("/"));
  const importers = files.filter((f) => /from\s+["']lucide-react["']/.test(readFileSync(join(WEB, f), "utf8")));

  it("no new file imports lucide-react directly", () => {
    const fresh = importers.filter((f) => !LEGACY.has(f) && !ALWAYS.has(f));
    expect(fresh, "import { Icon } from '@/components/ui/Icon' instead").toEqual([]);
  });

  it("the legacy list holds only files that still import lucide", () => {
    const stale = [...LEGACY].filter((f) => !importers.includes(f));
    expect(stale, "remove migrated files from LEGACY").toEqual([]);
  });
});
