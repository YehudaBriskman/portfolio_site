import { useState } from "react";
import { relative, useLang } from "@/components/dashboard/i18n";
import { ChannelRow } from "@/components/ui/ChannelIcon";
import { ICON } from "@/components/ui/icons";
import { RecordRow } from "@/components/ui/RecordRow";
import { StatusGlyph } from "@/components/ui/StatusGlyph";
import type { AnnounceKind, AnnounceSummary } from "@/services/adminAnnounce";
import { sortIssues, type Readiness } from "./readiness";
import { kindIcon, kindWord } from "../kind";
import { useMarketingWords } from "./words";

const KIND_ICON = {
  post: ICON.note,
  note: ICON.note,
  release: ICON.release,
  project: ICON.project,
  area: ICON.area,
  story: ICON.story,
  home: ICON.home,
  custom: ICON.announcement,
} satisfies Record<AnnounceKind, unknown>;

/*
 * The phone's inbox row: the kind, the title, how old it is, a dot when it is
 * new and four channel glyphs (filled = posted). Nothing else. What is wrong
 * with the page shows as ONE alert glyph, only when something is; a page that
 * is fine says nothing, so no row repeats "Ready". Everything else (captions,
 * Copy, Mark done) is one tap away in the sheet.
 */
export default function InboxPhoneRow({ event, readiness, onOpen }: { event: AnnounceSummary; readiness: Readiness | undefined; onOpen: () => void }) {
  const w = useMarketingWords();
  const lang = useLang();
  const [mounted] = useState(() => Date.now());
  const when = relative(event.createdAt, mounted, lang);
  const issues = readiness?.state === "ready" ? sortIssues(readiness.issues) : [];
  const worst = issues.some((i) => i.severity === "error");
  return (
    <RecordRow
      as="div"
      icon={kindIcon(KIND_ICON, event.kind)}
      title={event.title}
      unread={!event.readAt}
      facts={[{ text: when, label: kindWord(w.kinds, event.kind) }]}
      status={
        <span className="mk-pstatus">
          {issues.length > 0 && <StatusGlyph kind="attention" tone={worst ? "danger" : "attention"} label={issues.map((i) => w.chips[i.code]).join(", ")} />}
          <ChannelRow done={event.done} className="mk-chans" />
        </span>
      }
      openLabel={w.openRow(event.title)}
      onOpen={onOpen}
      className="mk-prow"
    />
  );
}
