import { Empty } from "@/components/admin/ui";
import type { Contact } from "@/services/adminAudience";
import { useWhen } from "./useWhen";
import { useAudienceWords } from "./words";

/* Every consent on record for one contact, newest first, with the wording shown and the confirmation. Shared by the desktop dialog and the phone sheet. */
export default function ConsentHistory({ contact, heading = true, className = "a-box space-y-1 p-3 text-sm" }: { contact: Contact; heading?: boolean; className?: string }) {
  const w = useAudienceWords();
  const when = useWhen();
  return (
    <section className={className} aria-label={w.consentHeading}>
      {heading && <h4 className="a-label !mb-0">{w.consentHeading}</h4>}
      {(contact.consentHistory?.length ? [...contact.consentHistory].reverse() : [null]).map((e, i) => (
        <div key={e?.at ?? "legacy"} className={i === 0 ? "space-y-1" : "space-y-1 border-t pt-1 opacity-80"}>
          {i === 1 && <h5 className="a-label !mb-0">{w.consentEarlier}</h5>}
          <p>{w.consentOn(when(e?.at ?? contact.consentAt), w.sources[e?.source ?? contact.source] ?? contact.source)}</p>
          <p className="text-clay">
            {e ? (e.confirmedAt ? w.consentConfirmedOn(when(e.confirmedAt)) : w.consentNotConfirmed) : null}
          </p>
          {e?.textId ? (
            <p className="text-clay">
              {w.consentWording}: <span dir="ltr" className="tabular-nums">{e.textId} · {e.lang} · {e.textHash?.slice(0, 12)}</span>
            </p>
          ) : e ? (
            <p className="text-clay">{w.consentNoWording}</p>
          ) : null}
          {(e?.note ?? (e ? "" : contact.consentNote)) ? (
            <p className="text-clay" dir="auto">{`${w.consentNoteLabel}: ${e?.note ?? contact.consentNote}`}</p>
          ) : !e ? <Empty /> : null}
        </div>
      ))}
    </section>
  );
}
