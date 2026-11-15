import { useEffect, useId, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SidePanel, useUnsavedGuard } from "@/components/ui/SidePanel";
import { adminAudience, CONTACT_STATUSES, type Contact, type ContactLang, type ContactStatus, type Group } from "@/services/adminAudience";
import ActionError from "./ActionError";
import ConsentHistory from "./ConsentHistory";
import { actionError, type ActionKind } from "./errors";
import Email from "./Email";
import { whyOf } from "./why";
import { useAudienceWords } from "./words";
import { useWhen } from "./useWhen";

export function Why({ c }: { c: Pick<Contact, "status" | "topics" | "unsubscribedAt"> }) {
  const w = useAudienceWords();
  const when = useWhen();
  const k = whyOf(c).key;
  const text = k === "unsubscribed" ? w.whyUnsubscribed(when(c.unsubscribedAt)) : k === "active" ? w.whyActive : k === "activeNoTopics" ? w.whyActiveNoTopics : k === "pending" ? w.whyPending : w.whySuppressed;
  return <span data-why={k}>{text}</span>;
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** Ask-before-leaving hook for the panel's owner: resolves true when the contact may be replaced or closed. */
export type LeaveGuard = () => Promise<boolean>;
/** The panel hands its guard up (`g`), and takes it back on unmount (`null`, with the one it set). */
export type GuardHook = (g: LeaveGuard | null, was?: LeaveGuard) => void;

/*
 * One contact in a side panel (A21): the list stays on screen while it is open. Name, language, groups, topics,
 * status and the erasure, exactly as the dialog had them. Closing with edits that are not saved asks first; with
 * none, it just closes. `onGuard` hands the same question to the list, so opening another row asks too.
 */
export default function ContactEditor({ contact, groups, open, onClose, onDone, onGuard }: { contact: Contact; groups: Group[]; open: boolean; onClose: () => void; onDone: () => void; onGuard?: GuardHook }) {
  const w = useAudienceWords();
  const uid = useId();
  const formId = `${uid}-form`;
  const [name, setName] = useState(contact.name ?? "");
  const [lang, setLang] = useState<ContactLang>(contact.lang ?? "en");
  const [status, setStatus] = useState<ContactStatus>(contact.status);
  const [sel, setSel] = useState<string[]>(contact.groups);
  const [topics, setTopics] = useState(contact.topics);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; again: () => void } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [asking, setAsking] = useState(false);
  const answer = useRef<((keep: boolean) => void) | null>(null);

  const dirty =
    name.trim() !== (contact.name ?? "") ||
    lang !== (contact.lang ?? "en") ||
    status !== contact.status ||
    !sameSet(sel, contact.groups) ||
    topics.blog !== contact.topics.blog ||
    topics.releases !== contact.topics.releases;

  /* The question is answered by the confirm below: Discard resolves true (go ahead), Keep editing false. */
  const ask = () => new Promise<boolean>((resolve) => ((answer.current = resolve), setAsking(true)));
  const settle = (go: boolean) => (setAsking(false), answer.current?.(go), (answer.current = null));
  const guard = useUnsavedGuard(dirty && !busy, ask);
  useEffect(() => {
    onGuard?.(guard);
    return () => onGuard?.(null, guard);
  }, [onGuard, guard]);

  /* A failure names the action that failed and offers to run that same action again. */
  const run = async (op: () => Promise<unknown>, kind: ActionKind): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await op();
      onDone();
    } catch (err) {
      setError({ text: actionError(err, kind, w), again: () => void run(op, kind) });
      setBusy(false);
    }
  };
  const save = () => run(() => adminAudience.patchContact(contact.hash, { name: name.trim(), lang, groups: sel, topics, status }), "save");
  const toggle = (slug: string) => setSel((s) => (s.includes(slug) ? s.filter((x) => x !== slug) : [...s, slug]));
  const live = { ...contact, status, topics };

  return (
    <>
      <SidePanel
        open={open}
        onOpenChange={(o) => !o && onClose()}
        beforeClose={guard}
        title={w.editorHeading}
        footer={
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" form={formId} className="a-btn a-btn-primary min-h-[44px]" disabled={busy}>{busy ? w.saving : w.save}</button>
            <button type="button" className="a-btn a-btn-ghost min-h-[44px]" onClick={() => void guard().then((ok) => ok && onClose())}>{w.cancel}</button>
          </div>
        }
      >
        <form id={formId} className="space-y-4" onSubmit={(e) => (e.preventDefault(), void save())}>
          <p className="text-sm"><Email value={contact.email} /></p>
          <p className="a-hint !mt-0" role="status"><Why c={live} /></p>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="a-label" htmlFor={`${uid}-n`}>{w.name}</label>
              <input id={`${uid}-n`} className="a-input min-h-[44px]" dir="auto" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="a-label" htmlFor={`${uid}-l`}>{w.language}</label>
              <select id={`${uid}-l`} className="a-select min-h-[44px] w-full" value={lang} onChange={(e) => setLang(e.target.value as ContactLang)}>
                {(["en", "he"] as const).map((l) => <option key={l} value={l}>{w.langs[l]}</option>)}
              </select>
            </div>
            <div>
              <label className="a-label" htmlFor={`${uid}-s`}>{w.statusLabel}</label>
              <select id={`${uid}-s`} className="a-select min-h-[44px] w-full" value={status} aria-describedby={`${uid}-sh`} onChange={(e) => setStatus(e.target.value as ContactStatus)}>
                {CONTACT_STATUSES.map((s) => <option key={s} value={s}>{w.statuses[s]}</option>)}
              </select>
              <p id={`${uid}-sh`} className="a-hint">{w.statusHint}</p>
            </div>
          </div>

          <fieldset className="space-y-1">
            <legend className="a-label">{w.topicsLabel}</legend>
            {(["blog", "releases"] as const).map((t) => (
              <label key={t} className="flex min-h-[44px] items-center gap-2 text-sm">
                <input type="checkbox" className="h-5 w-5" checked={topics[t]} onChange={(e) => setTopics({ ...topics, [t]: e.target.checked })} />
                <span>{w.topics[t]}</span>
              </label>
            ))}
          </fieldset>

          <fieldset className="space-y-1">
            <legend className="a-label">{w.groupsLabel}</legend>
            {groups.length === 0 && <p className="a-hint">{w.noGroups}</p>}
            {groups.map((g) => (
              <label key={g.slug} className="flex min-h-[44px] items-center gap-2 text-sm">
                <input type="checkbox" className="h-5 w-5" checked={sel.includes(g.slug)} onChange={() => toggle(g.slug)} />
                <span dir="auto">{g.name}</span>
              </label>
            ))}
          </fieldset>

          <ConsentHistory contact={contact} />

          {error && <ActionError text={error.text} onRetry={error.again} busy={busy} />}

          <div className="border-t border-[rgb(var(--rule-firm)/.4)] pb-2 pt-3">
            <p className="a-hint !mt-0">{w.eraseHint}</p>
            {confirm ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className="a-btn min-h-[44px] !border-[rgb(var(--destructive-ink))] text-[rgb(var(--destructive-ink))]" disabled={busy} onClick={() => void run(() => adminAudience.eraseContact(contact.hash), "erase")}>{w.eraseConfirm(contact.email)}</button>
                <button type="button" className="a-btn a-btn-ghost min-h-[44px]" onClick={() => setConfirm(false)}>{w.cancel}</button>
              </div>
            ) : (
              <button type="button" className="a-btn a-btn-ghost mt-2 min-h-[44px] text-[rgb(var(--destructive-ink))]" onClick={() => setConfirm(true)}>{w.erase}</button>
            )}
          </div>
        </form>
      </SidePanel>
      <ConfirmDialog open={asking} title={w.guardTitle} confirm={w.guardDiscard} cancel={w.guardKeep} tone="neutral" onConfirm={() => settle(true)} onCancel={() => settle(false)}>
        {w.guardBody}
      </ConfirmDialog>
    </>
  );
}
