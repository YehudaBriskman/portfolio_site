/* eslint-disable react-refresh/only-export-components -- entry file, never hot-reloaded */
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "@/index.css";
import { Disclosure, DisclosureButton } from "@/components/ui/Disclosure";

const params = new URLSearchParams(location.search);
const rtl = params.get("dir") === "rtl";
const open = params.get("open") === "1";
document.documentElement.dir = rtl ? "rtl" : "ltr";
document.documentElement.lang = rtl ? "he" : "en";

const t = rtl
  ? { adv: "הגדרות מתקדמות", meta: "שינויים שלא נשמרו", body: "תוכן הפירוט נמצא כאן, בתוך האזור שנפתח.", more: "עוד אפשרויות" }
  : { adv: "Advanced settings", meta: "unsaved changes", body: "The detail lives here, inside the region that opens.", more: "More options" };

function Demo() {
  const [on, setOn] = useState(open);
  return (
    <main style={{ padding: 16, maxWidth: 560, margin: "0 auto", background: "rgb(var(--paper))", minHeight: "100vh" }}>
      <Disclosure summary={t.adv} meta={t.meta} open={open} testid="d1">
        <p style={{ margin: 0, fontSize: "0.9375rem", color: "rgb(var(--ink-soft))" }}>{t.body}</p>
      </Disclosure>
      <Disclosure summary={t.adv} open={false}>
        <p>{t.body}</p>
      </Disclosure>
      <DisclosureButton expanded={on} controls="p1" onToggle={() => setOn(!on)}>
        {t.more}
      </DisclosureButton>
      <div id="p1" hidden={!on} style={{ padding: "0.5rem 0.75rem", fontSize: "0.9375rem" }}>
        {t.body}
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Demo />);
