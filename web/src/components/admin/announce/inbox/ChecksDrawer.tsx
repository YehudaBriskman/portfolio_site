import LinkPreview from "../LinkPreview";
import { CardPreview } from "../previews";
import type { AnnounceLang, AnnounceSummary } from "@/services/adminAnnounce";
import { useMarketingWords } from "./words";

/* Rare things, out of the way: how the link reads, the card images, and removing the event. */
export default function ChecksDrawer({
  id,
  event,
  lang,
  origin,
  busy,
  onDismiss,
  onClose,
}: {
  id: string;
  event: AnnounceSummary;
  lang: AnnounceLang;
  origin: string;
  busy: boolean;
  onDismiss: () => void;
  onClose: () => void;
}) {
  const w = useMarketingWords();
  const hasCards = event.kind === "post" || event.kind === "note" || event.kind === "release";
  return (
    <section id={id} className="a-box mk-drawer" aria-labelledby={`${id}-h`}>
      <div className="a-box-row">
        <span className="min-w-0 flex-1">
          <h3 id={`${id}-h`} className="a-row-title">
            {w.checksHeading}
          </h3>
          <span className="a-hint !mt-0">{w.checksHint}</span>
        </span>
        <button type="button" className="a-btn a-btn-ghost mk-btn" onClick={onClose}>
          {w.close}
        </button>
      </div>
      <LinkPreview eventId={event.id} lang={lang} />
      <div className="border-t border-[rgb(var(--rule-firm)/0.5)] p-4">
        <h4 className="a-row-title">{w.cardsHeading}</h4>
        {hasCards ? (
          <CardPreview kind={event.kind === "release" ? "release" : "blog"} file={`${event.ref}.png`} lang={lang} origin={origin} />
        ) : (
          <p className="a-hint">{w.cardsOnlyNotes}</p>
        )}
      </div>
      <div className="a-box-foot flex flex-wrap items-center gap-3">
        <button type="button" className="a-btn a-btn-danger mk-btn" disabled={busy} onClick={onDismiss}>
          {w.dismiss}
        </button>
        <span className="a-hint !mt-0">{w.dismissHint}</span>
      </div>
    </section>
  );
}
