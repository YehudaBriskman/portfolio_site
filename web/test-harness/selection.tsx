/* eslint-disable react-refresh/only-export-components -- entry file, never hot-reloaded */
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Archive, CheckCheck, FileText, Megaphone, Rocket, Trash2 } from "lucide-react";
import "@/index.css";
import { RecordRow } from "@/components/ui/RecordRow";
import { StatusGlyph } from "@/components/ui/StatusGlyph";
import { SelectionBar, SelectionHeader, type SelectionAction } from "@/components/ui/SelectionBar";
import { useSelection } from "@/components/ui/useSelection";
import { UndoToast, useUndoable } from "@/components/ui/UndoToast";

const params = new URLSearchParams(location.search);
const rtl = params.get("dir") === "rtl";
const dark = params.get("theme") === "dark";
document.documentElement.dir = rtl ? "rtl" : "ltr";
document.documentElement.lang = rtl ? "he" : "en";
document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");

const t = rtl
  ? {
      title: "פוסטים", archive: "העברה לארכיון", mark: "סימון כנקרא", del: "מחיקה", open: (s: string) => `פתיחת ${s}`,
      archived: (n: number) => `הועברו לארכיון ${n} פוסטים`, delN: (n: number) => `מחיקת ${n} פוסטים`,
      rows: ["הכרזה על הגרסה החדשה של האתר", "הערות לגרסה 1.4.3 - תיקוני יציבות ושיפורי נגישות במסכי המובייל של הניהול", "פוסט בלינקדאין", "סיכום חצי שנה", "מה למדתי מבניית מערכת עיצוב"],
      fact: "לפני שעתיים",
    }
  : {
      title: "Posts", archive: "Archive", mark: "Mark read", del: "Delete", open: (s: string) => `Open ${s}`,
      archived: (n: number) => `Archived ${n} posts`, delN: (n: number) => `Delete ${n} posts`,
      rows: ["Announcing the new site release", "Release notes 1.4.3 - stability fixes and accessibility polish across the admin's phone screens", "LinkedIn post", "Half-year review", "What I learned building a design system"],
      fact: "2h ago",
    };
const ICONS = [Rocket, FileText, Megaphone, FileText, FileText];

function Demo() {
  const [gone, setGone] = useState<number[]>([]);
  const shown = [0, 1, 2, 3, 4].filter((i) => !gone.includes(i));
  const sel = useSelection(shown);
  const undo = useUndoable();
  const actions: SelectionAction<number>[] = [
    {
      id: "archive", icon: Archive, label: t.archive,
      run: (ids) => {
        setGone((g) => [...g, ...ids]);
        undo.schedule({ message: t.archived(ids.length), commit: () => {}, onUndo: () => setGone((g) => g.filter((x) => !ids.includes(x))) });
      },
    },
    { id: "read", icon: CheckCheck, label: t.mark, run: () => {} },
    { id: "delete", icon: Trash2, label: t.del, destructive: true, confirm: t.delN, run: () => {} },
  ];
  const q = params.get("state");
  return (
    <div className="a-app" style={{ padding: "1rem", minBlockSize: "100dvh", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <h1 style={{ fontWeight: 700, margin: 0 }}>{t.title}</h1>
        <SelectionHeader selection={sel} total={shown.length} />
      </div>
      <div style={{ border: "1px solid var(--a-line)", borderRadius: "var(--a-r-box)", marginBlock: 12 }}>
        {shown.map((i) => (
          <RecordRow
            key={i}
            icon={ICONS[i]}
            title={t.rows[i]}
            facts={[{ text: t.fact }]}
            status={i === 1 ? <StatusGlyph kind="failed" /> : undefined}
            selectable={sel.on}
            selected={sel.has(i)}
            openLabel={t.open(t.rows[i])}
            onOpen={() => (sel.on ? sel.toggle(i) : undefined)}
            onLongPress={() => sel.enter(i)}
          />
        ))}
      </div>
      <div style={{ flex: 1 }} />
      <SelectionBar selection={sel} actions={actions} />
      <UndoToast undoable={undo} />
      <Auto state={q} sel={sel} undoer={undo} actions={actions} />
    </div>
  );
}

import { useEffect } from "react";
import type { Selection } from "@/components/ui/useSelection";
import type { Undoable } from "@/components/ui/UndoToast";

/** Puts the demo into a state for a screenshot: ?state=select | undo. */
function Auto({ state, sel, undoer, actions }: { state: string | null; sel: Selection<number>; undoer: Undoable; actions: SelectionAction<number>[] }) {
  useEffect(() => {
    if (state === "select") {
      sel.enter(0);
      sel.toggle(1);
    } else if (state === "undo") {
      undoer.schedule({ message: t.archived(2), commit: () => {} });
    } else if (state === "more") {
      sel.enter(0);
      sel.toggle(1);
      setTimeout(() => (document.querySelector("[role=toolbar] button:last-child") as HTMLButtonElement | null)?.click(), 100);
    } else if (state === "confirm") {
      sel.enter(0);
      sel.toggle(1);
      void actions;
      setTimeout(() => (document.querySelector("[role=toolbar] button:last-child") as HTMLButtonElement | null)?.click(), 100);
      setTimeout(() => (Array.from(document.querySelectorAll("dialog[open] button")).find((b) => b.textContent?.includes(t.del)) as HTMLButtonElement | undefined)?.click(), 300);
    }
    // once, on load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

createRoot(document.getElementById("root")!).render(<Demo />);
