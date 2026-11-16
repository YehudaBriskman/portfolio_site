import { useState } from "react";
import { relative, useLang } from "@/components/dashboard/i18n";
import { ICON } from "@/components/ui/icons";
import { RecordRow } from "@/components/ui/RecordRow";
import { StatusGlyph } from "@/components/ui/StatusGlyph";
import type { AnnounceKind, AnnounceSummary } from "@/services/adminAnnounce";
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
 * with the page is said once, by the group header above the rows that have an
 * issue (the inbox draws it), so no row repeats a warning or "Ready". Everything else (captions,
 * Copy, Mark done) is one tap away in the sheet.
 */
export default function InboxPhoneRow({ event, onOpen }: { event: AnnounceSummary; onOpen: () => void }) {
  const w = useMarketingWords();
  const lang = useLang();
  const [mounted] = useState(() => Date.now());
  const when = relative(event.createdAt, mounted, lang);
  const sent = (["linkedin", "instagram", "email", "x"] as const).every((c) => Boolean(c === "email" ? event.done.email ?? event.done.gmail : event.done[c]));
  return (
    <RecordRow
      as="div"
      icon={kindIcon(KIND_ICON, event.kind)}
      title={event.title}
      unread={!event.readAt}
      facts={[{ text: when, label: kindWord(w.kinds, event.kind) }]}
      status={
        <span className="mk-pstatus">
          {sent && <StatusGlyph kind="sent" label={w.channelsState} />}
        </span>
      }
      openLabel={w.openRow(event.title)}
      onOpen={onOpen}
      className="mk-prow"
    />
  );
}
