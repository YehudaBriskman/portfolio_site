import { Check, FileText, Home, Layers, Megaphone, Package, Rocket, User } from "lucide-react";
import { RelTime } from "@/components/admin/ui";
import type { AnnounceChannel, AnnounceKind, AnnounceSummary } from "@/services/adminAnnounce";
import { ReadinessChips } from "./Chips";
import type { Readiness } from "./readiness";
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

const DOTS = ["linkedin", "instagram", "email", "x"] as const;
const doneOf = (ev: AnnounceSummary, c: (typeof DOTS)[number]) => (c === "email" ? ev.done.email ?? ev.done.gmail : ev.done[c as AnnounceChannel]);

/*
 * One line per event: kind, title, age, which channels are sent, what needs
 * fixing, and the two quick copies. The title is the button that opens the
 * composer, so the row is one tab stop for the common action plus two.
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
  const Icon = ICONS[event.kind];
  const unread = !event.readAt;
  return (
    <li className="mk-row" data-selected={selected || undefined} data-unread={unread || undefined} data-id={event.id}>
      <button type="button" className="mk-row-main" onClick={onOpen} aria-label={w.openComposer(event.title)} aria-current={selected ? "true" : undefined}>
        <span className="mk-kind" title={w.kinds[event.kind]}>
          <Icon aria-hidden="true" />
          <span className="sr-only">{w.kinds[event.kind]}</span>
        </span>
        <span className="mk-title">
          <bdi>{event.title}</bdi>
        </span>
        {unread && <span className="mk-new">{w.newBadge}</span>}
        <span className="mk-age">
          <RelTime iso={event.createdAt} />
        </span>
      </button>
      <span className="mk-dots" role="group" aria-label={w.channelsState}>
        {DOTS.map((c) => {
          const done = Boolean(doneOf(event, c));
          return (
            <span key={c} className="mk-dot" data-done={done || undefined} role="img" aria-label={done ? w.channelDone(w.channels[c]) : w.channelTodo(w.channels[c])}>
              {done && <Check aria-hidden="true" />}
            </span>
          );
        })}
      </span>
      <span className="mk-chips">
        <ReadinessChips readiness={readiness} />
      </span>
      <span className="mk-quick">
        <button type="button" className="a-btn mk-btn" onClick={() => onCopy("linkedin")} aria-label={w.copyLinkedInFor(event.title)}>
          {w.copyLinkedIn}
        </button>
        <button type="button" className="a-btn mk-btn" onClick={() => onCopy("x")} aria-label={w.copyXFor(event.title)}>
          {w.copyX}
        </button>
      </span>
      {note && (
        <span role="status" className="mk-note">
          {note}
        </span>
      )}
    </li>
  );
}
