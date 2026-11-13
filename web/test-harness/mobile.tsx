/* eslint-disable react-refresh/only-export-components -- entry file, never hot-reloaded */
import { useState, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { Clock, FileText, Megaphone, Rocket, Languages } from "lucide-react";
import "@/index.css";
import { BottomSheet, type Snap } from "@/components/ui/BottomSheet";
import { RecordRow } from "@/components/ui/RecordRow";
import { STATUS_KINDS, StatusGlyph } from "@/components/ui/StatusGlyph";
import { CHANNELS, ChannelIcon, ChannelRow } from "@/components/ui/ChannelIcon";
import { CONCEPTS, ICON } from "@/components/ui/icons";
import { useMobileWords } from "@/i18n/mobile";

const params = new URLSearchParams(location.search);
const rtl = params.get("dir") === "rtl";
const dark = params.get("theme") === "dark";
const sheetParam = params.get("sheet"); // "peek" | "half" | "full"
document.documentElement.dir = rtl ? "rtl" : "ltr";
document.documentElement.lang = rtl ? "he" : "en";
document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");

const t = rtl
  ? {
      rows: "שורות", glyphs: "סטטוס", chans: "ערוצים", icons: "אוצר האייקונים", open: "פתיחת הלשונית", title: "פרטי הרשומה",
      body: "כאן נמצא הפירוט של הרשומה. הגיליון נפתח בחצי גובה ואפשר למשוך אותו למעלה עד הסוף.",
      save: "שמירה", cancel: "ביטול",
      r1: "הכרזה על הגרסה החדשה של האתר",
      r2: "הערות לגרסה 1.4.3 - תיקוני יציבות ושיפורי נגישות במסכי המובייל של הניהול, כולל שורות ארוכות",
      r3: "פוסט בלינקדאין", f1: "לפני שעתיים", f2: "תשעה ערוצים", f3: "id-4411", openR: (s: string) => `פתיחת ${s}`,
    }
  : {
      rows: "Rows", glyphs: "Status", chans: "Channels", icons: "Icon vocabulary", open: "Open the sheet", title: "Record details",
      body: "The detail of the record lives here. The sheet opens at half height and pulls up to full.",
      save: "Save", cancel: "Cancel",
      r1: "Announcing the new site release",
      r2: "Release notes 1.4.3 - stability fixes and accessibility polish across the admin's phone screens, including very long rows",
      r3: "LinkedIn post", f1: "2h ago", f2: "9 channels", f3: "id-4411", openR: (s: string) => `Open ${s}`,
    };

const h2 = { fontWeight: 700, marginBlockStart: 16 } as const;

function Demo() {
  const [open, setOpen] = useState(Boolean(sheetParam));
  const w = useMobileWords();
  const snap = (sheetParam === "peek" || sheetParam === "full" ? sheetParam : "half") as Snap;
  return (
    <div className="a-app" style={{ padding: "1rem" }}>
      <h2 style={{ fontWeight: 700 }}>{t.rows}</h2>
      <div style={{ border: "1px solid var(--a-line)", borderRadius: "var(--a-r-box)", marginBlockEnd: 16 }}>
        <RecordRow icon={Rocket} title={t.r1} facts={[{ icon: Clock, text: t.f1 }]} status={<StatusGlyph kind="scheduled" />} unread openLabel={t.openR(t.r1)} onOpen={() => setOpen(true)} />
        <RecordRow icon={FileText} title={t.r2} facts={[{ text: t.f1, icon: Clock }, { text: t.f3, dir: "ltr" }]} status={<StatusGlyph kind="failed" />} openLabel={t.openR(t.r2)} onOpen={() => setOpen(true)} />
        <RecordRow icon={Megaphone} title={t.r3} facts={[{ text: t.f2 }]} status={<ChannelRow done={{ linkedin: "x", email: "y" }} />} openLabel={t.openR(t.r3)} onOpen={() => setOpen(true)} />
        <RecordRow icon={Languages} title={t.r1} facts={[{ text: t.f1 }]} status={<StatusGlyph kind="stale" />} selectable selected openLabel={t.openR(t.r1)} onOpen={() => {}} />
      </div>
      <button type="button" className="a-btn" onClick={() => setOpen(true)}>{t.open}</button>

      <h2 style={h2}>{t.glyphs}</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {STATUS_KINDS.map((k) => <StatusGlyph key={k} kind={k} showDefault />)}
      </div>
      <div style={{ display: "grid", gap: 4, marginBlockStart: 8 }}>
        {(["failed", "changes", "sent"] as const).map((k) => <StatusGlyph key={k} kind={k} withWord size={24} />)}
      </div>

      <h2 style={h2}>{t.chans}</h2>
      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <ChannelRow done={{ linkedin: "x", email: "y" }} />
        <ChannelRow done={{}} />
        <ChannelRow done={{ linkedin: "a", x: "b", instagram: "c", email: "d" }} size={24} />
      </div>
      <div style={{ display: "flex", gap: 12, marginBlockStart: 8 }}>
        {CHANNELS.map((c) => (
          <span key={c} style={{ display: "inline-flex", gap: 4 }}>
            <ChannelIcon channel={c} done />
            <ChannelIcon channel={c} done={false} />
          </span>
        ))}
      </div>

      <h2 style={h2}>{t.icons}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))", gap: 8 }}>
        {CONCEPTS.map((c) => {
          const I = ICON[c] as ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
          return (
            <div key={c} style={{ display: "grid", justifyItems: "center", gap: 4, textAlign: "center", fontSize: ".75rem", color: "rgb(var(--ink-soft))" }}>
              <I size={24} aria-hidden />
              <span>{w.icons[c]}</span>
            </div>
          );
        })}
      </div>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={t.title}
        snap={snap}
        snaps={["peek", "half", "full"]}
        footer={
          <>
            <button type="button" className="a-btn a-btn-primary" onClick={() => setOpen(false)}>{t.save}</button>
            <button type="button" className="a-btn" onClick={() => setOpen(false)}>{t.cancel}</button>
          </>
        }
      >
        <p style={{ marginBlockStart: 0 }}>{t.body}</p>
        {Array.from({ length: 12 }, (_, i) => <p key={i}>{t.body}</p>)}
      </BottomSheet>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Demo />);
