import LinkPreview from "../LinkPreview";
import { CardPreview } from "../previews";
import type { AnnounceLang, AnnounceSummary } from "@/services/adminAnnounce";
import { useMarketingWords } from "./words";

/* The detail behind the one-line checks summary: how the link reads and the card images. */
export default function ChecksDrawer({
  id,
  event,
  lang,
  origin,
  target,
}: {
  id: string;
  event: AnnounceSummary;
  lang: AnnounceLang;
  /** The site's origin, never the event's own address: a release's address is on GitHub. */
  origin: string;
  /** Where the link really goes, shown when the event has no page of its own. */
  target: string;
}) {
  const w = useMarketingWords();
  const hasCards = event.kind === "post" || event.kind === "note" || event.kind === "release";
  return (
    <div id={id} className="a-box mk-drawer">
      <LinkPreview eventId={event.id} lang={lang} target={event.kind === "release" ? target : undefined} />
      <div className="border-t border-[rgb(var(--rule-firm)/0.5)] p-4">
        <h4 className="a-row-title">{w.cardsHeading}</h4>
        {hasCards ? (
          <CardPreview kind={event.kind === "release" ? "release" : "blog"} file={`${event.ref}.png`} lang={lang} origin={origin} />
        ) : (
          <p className="a-hint">{w.cardsOnlyNotes}</p>
        )}
      </div>
    </div>
  );
}
