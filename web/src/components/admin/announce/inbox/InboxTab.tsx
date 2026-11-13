import "./inbox.css";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Megaphone, Plus } from "lucide-react";
import { EmptyState, ErrorState, LoadingRows } from "@/components/admin/ui";
import { copyText } from "@/lib/share";
import { adminAnnounce, type AnnounceSummary } from "@/services/adminAnnounce";
import Composer from "./Composer";
import InboxRow from "./InboxRow";
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

export default function InboxTab({ items, error, onRetry, onChange, onCreated }: Props) {
  const w = useMarketingWords();
  const [openId, setOpenId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const newId = useId();
  const [note, setNote] = useState<{ id: string; text: string } | null>(null);
  const readiness = useReadiness(items, openId);
  const listRef = useRef<HTMLUListElement>(null);

  const list = items ?? [];
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

  if (open)
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
        <KeyHint id="mk-keys" mode="list" />
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
        <ul ref={listRef} className="mk-list" aria-label={w.list(items.length)} aria-describedby="mk-keys">
          {items.map((e) => (
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
          ))}
        </ul>
      )}
    </div>
  );
}
