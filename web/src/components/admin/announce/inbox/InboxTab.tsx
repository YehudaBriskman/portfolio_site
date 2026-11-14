import "./inbox.css";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Megaphone, Plus } from "lucide-react";
import { EmptyState, ErrorState, LoadingRows } from "@/components/admin/ui";
import { usePhone } from "@/hooks/usePhone";
import { copyText } from "@/lib/share";
import { adminAnnounce, type AnnounceChannel, type AnnounceSummary } from "@/services/adminAnnounce";
import Composer from "./Composer";
import InboxPhoneRow from "./InboxPhoneRow";
import InboxRow from "./InboxRow";
import InboxSheet from "./InboxSheet";
import KeyHint from "./KeyHint";
import NewAnnouncement from "./NewAnnouncement";
import { useReadiness } from "./readiness";
import { useHotkeys } from "./useHotkeys";
import { useMarketingWords } from "./words";

type Props = {
  items: AnnounceSummary[] | null;
  error: "load" | "auth" | null;
  onRetry: () => void;
  /** The server's copy after a change; `null` removes the event. */
  onChange: (id: string, next: AnnounceSummary | null) => void;
  onCreated: (ev: AnnounceSummary) => void;
};

/** How long "Mark done" can be taken back; nothing is saved until it has passed. */
export const UNDO_MS = 8000;

type Pending = { id: string; channel: AnnounceChannel; at: string };

export default function InboxTab({ items, error, onRetry, onChange, onCreated }: Props) {
  const w = useMarketingWords();
  const phone = usePhone();
  const [openId, setOpenId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const newId = useId();
  const [note, setNote] = useState<{ id: string; text: string } | null>(null);
  const readiness = useReadiness(items, openId);
  const listRef = useRef<HTMLUListElement>(null);

  /* "Mark done" waits UNDO_MS before it is saved, so Undo needs no endpoint: the row shows it done meanwhile. */
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const changeRef = useRef(onChange);
  useEffect(() => {
    changeRef.current = onChange;
  });

  const commit = useCallback(
    (p: Pending) => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
      undoTimer.current = null;
      pendingRef.current = null;
      setPending(null);
      adminAnnounce.done(p.id, p.channel).then(
        (r) => r.event && changeRef.current(p.id, r.event),
        () => setNote({ id: p.id, text: w.actionFailed }),
      );
    },
    [w],
  );
  const markDone = (id: string, channel: AnnounceChannel) => {
    if (pendingRef.current) commit(pendingRef.current);
    const p = { id, channel, at: new Date().toISOString() };
    pendingRef.current = p;
    setPending(p);
    undoTimer.current = setTimeout(() => commit(p), UNDO_MS);
  };
  const undoDone = () => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = null;
    pendingRef.current = null;
    setPending(null);
  };
  /* Leaving the tab inside the window keeps what was asked for. */
  useEffect(
    () => () => {
      if (pendingRef.current) void adminAnnounce.done(pendingRef.current.id, pendingRef.current.channel).catch(() => undefined);
      if (undoTimer.current) clearTimeout(undoTimer.current);
    },
    [],
  );

  const list = useMemo(
    () => (items ?? []).map((e) => (pending && pending.id === e.id ? { ...e, done: { ...e.done, [pending.channel]: pending.at } } : e)),
    [items, pending],
  );
  const selected = list.find((e) => e.id === selectedId) ?? list[0] ?? null;
  const open = list.find((e) => e.id === openId) ?? null;

  const move = (d: 1 | -1) => {
    if (list.length === 0) return;
    const i = Math.max(0, list.findIndex((e) => e.id === selected?.id));
    const to = list[Math.min(list.length - 1, Math.max(0, i + d))];
    setSelectedId(to.id);
    /* Focus follows the selection, so a screen reader reads the row it landed on. */
    listRef.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(to.id)}"] .mk-row-main`)?.focus();
  };

  const quickCopy = useCallback(
    async (ev: AnnounceSummary, channel: "linkedin" | "x") => {
      const name = w.channels[channel];
      try {
        const d = await adminAnnounce.get(ev.id);
        const kit = d.kit.en[channel] ? d.kit.en : d.kit.he;
        const text = kit[channel]?.text;
        if (!text) return setNote({ id: ev.id, text: w.quickFailed });
        setNote({ id: ev.id, text: (await copyText(text)) ? w.copied(name) : w.copyFailed });
      } catch {
        setNote({ id: ev.id, text: w.quickFailed });
      }
    },
    [w],
  );

  useHotkeys(
    {
      j: () => move(1),
      k: () => move(-1),
      c: () => selected && void quickCopy(selected, "linkedin"),
      o: () => selected && setOpenId(selected.id),
    },
    !open && !creating,
  );

  useEffect(() => {
    if (note) {
      const t = setTimeout(() => setNote(null), 4000);
      return () => clearTimeout(t);
    }
  }, [note]);

  if (open && !phone)
    return (
      <Composer
        key={open.id}
        event={open}
        onBack={() => setOpenId(null)}
        onChange={(next) => {
          if (next === null) setOpenId(null);
          onChange(open.id, next);
        }}
      />
    );

  return (
    <div>
      <div className="mk-toolbar">
        {!phone && <KeyHint id="mk-keys" mode="list" />}
        <button type="button" className="a-btn a-btn-primary mk-btn" aria-expanded={creating} aria-controls={newId} onClick={() => setCreating((v) => !v)}>
          <Plus aria-hidden="true" />
          {w.newAnnouncement}
        </button>
      </div>

      {creating && (
        <div id={newId} className="mb-4">
          <NewAnnouncement
            onCancel={() => setCreating(false)}
            onCreated={(ev) => {
              setCreating(false);
              onCreated(ev);
              setSelectedId(ev.id);
              setOpenId(ev.id);
            }}
          />
        </div>
      )}

      {error === "auth" ? (
        <p className="a-box a-box-row">{w.notAuthorised}</p>
      ) : error ? (
        <ErrorState message={w.loadFailed} onRetry={onRetry} />
      ) : items === null ? (
        <LoadingRows rows={4} />
      ) : items.length === 0 ? (
        <EmptyState title={w.emptyTitle}>
          <Megaphone aria-hidden="true" className="mx-auto mb-2 h-5 w-5" />
          {w.emptyText}
        </EmptyState>
      ) : (
        <ul ref={listRef} className={phone ? "mk-list mk-plist" : "mk-list"} aria-label={w.list(items.length)} aria-describedby={phone ? undefined : "mk-keys"}>
          {list.map((e) =>
            phone ? (
              <InboxPhoneRow
                key={e.id}
                event={e}
                readiness={readiness[e.id]}
                onOpen={() => {
                  setSelectedId(e.id);
                  setOpenId(e.id);
                }}
              />
            ) : (
            <InboxRow
              key={e.id}
              event={e}
              selected={e.id === selected?.id}
              readiness={readiness[e.id]}
              note={note?.id === e.id ? note.text : undefined}
              onOpen={() => {
                setSelectedId(e.id);
                setOpenId(e.id);
              }}
              onCopy={(c) => {
                setSelectedId(e.id);
                void quickCopy(e, c);
              }}
            />
            ),
          )}
        </ul>
      )}

      {phone && (
        <InboxSheet
          event={open}
          onClose={() => setOpenId(null)}
          onChange={(next) => {
            if (open) onChange(open.id, next);
          }}
          undo={pending && open && pending.id === open.id ? { channel: pending.channel, onUndo: undoDone } : null}
          onMarkDone={(channel) => open && markDone(open.id, channel)}
        />
      )}
      {phone && pending && !open && (
        <div className="mk-undobar" role="status">
          <span>{w.markedUndo(w.channels[pending.channel])}</span>
          <button type="button" className="a-btn mk-btn" onClick={undoDone}>
            {w.undo}
          </button>
        </div>
      )}
    </div>
  );
}
