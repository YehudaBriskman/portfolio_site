import { Copy, FileText, Home, Layers, Megaphone, Package, Rocket, User } from "lucide-react";
import { RelTime } from "@/components/admin/ui";
import type { AnnounceChannel, AnnounceKind, AnnounceSummary } from "@/services/adminAnnounce";
import { iconOf } from "@/components/ui/Icon";
import { StatusGlyph } from "@/components/ui/StatusGlyph";
import { RowActions } from "@/components/ui/RowActions";
import { useMobileWords } from "@/i18n/mobile";
import { sortIssues, type Readiness } from "./readiness";
import { kindWord } from "../kind";
import { useMarketingWords } from "./words";

const ICONS: Record<AnnounceKind, typeof FileText> = {
  post: FileText,
  note: FileText,
  release: Rocket,
  project: Package,
  area: Layers,
  story: User,
  home: Home,
  custom: Megaphone,
};

const CopyIcon = iconOf(Copy, 16);
const DONE = ["linkedin", "instagram", "email", "x"] as const;

/*
 * One line per event: kind, title, age, ONE status glyph, and the actions.
 * The status says something only when there is something to say: a warning
 * when the page has an issue, a check when every channel is sent; a row that
 * is simply waiting shows nothing. The title opens the composer; Copy LinkedIn
 * is the one action drawn, Copy X sits in More. Per-channel progress and the
 * issue chips live in the composer.
 */
export default function InboxRow({
  event,
  selected,
  readiness,
  onOpen,
  onCopy,
  note,
}: {
  event: AnnounceSummary;
  selected: boolean;
  readiness: Readiness | undefined;
  onOpen: () => void;
  onCopy: (channel: "linkedin" | "x") => void;
  note?: string;
}) {
  const w = useMarketingWords();
  const more = useMobileWords().selection.more;
  const Icon = ICONS[event.kind] ?? ICONS.custom;
  const unread = !event.readAt;
  const issues = readiness?.state === "ready" ? sortIssues(readiness.issues) : [];
  const sent = DONE.every((c) => Boolean(c === "email" ? event.done.email ?? event.done.gmail : event.done[c as AnnounceChannel]));
  const worst = issues.some((i) => i.severity === "error");
  const issueText = issues.map((i) => w.chips[i.code]).join(", ");
  return (
    <li className="mk-row" data-selected={selected || undefined} data-unread={unread || undefined} data-id={event.id}>
      <button type="button" className="mk-row-main" onClick={onOpen} aria-label={w.openComposer(event.title)} aria-current={selected ? "true" : undefined}>
        <span className="mk-kind" title={kindWord(w.kinds, event.kind)}>
          <Icon aria-hidden="true" />
          <span className="sr-only">{kindWord(w.kinds, event.kind)}</span>
        </span>
        <span className="mk-title" dir="auto">
          <bdi>{event.title}</bdi>
        </span>
        {unread && (
          <span className="mk-new" title={w.newBadge}>
            <span className="sr-only">{w.newBadge}</span>
          </span>
        )}
        <span className="mk-age">
          <RelTime iso={event.createdAt} />
        </span>
      </button>
      <span className="mk-status1">
        {issues.length > 0 ? (
          <StatusGlyph kind="attention" tone={worst ? "danger" : "attention"} label={issueText} />
        ) : sent ? (
          <StatusGlyph kind="sent" label={w.channelsState} />
        ) : null}
      </span>
      <RowActions
        label={event.title}
        moreLabel={more}
        primary={{ id: "copy-linkedin", icon: CopyIcon, label: w.copyLinkedIn, onSelect: () => onCopy("linkedin") }}
        actions={[{ id: "copy-x", icon: CopyIcon, label: w.copyX, onSelect: () => onCopy("x") }]}
      />
      {note && (
        <span role="status" className="mk-note">
          {note}
        </span>
      )}
    </li>
  );
}
