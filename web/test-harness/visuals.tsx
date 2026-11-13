/* eslint-disable react-refresh/only-export-components -- entry file, never hot-reloaded */
import { createRoot } from "react-dom/client";
import { Clock, FileText, Mail, Users } from "lucide-react";
import "@/index.css";
import { Journey, LifecycleStepper } from "@/components/ui/Journey";
import { MiniBar } from "@/components/ui/MiniBar";
import { Gauge } from "@/components/ui/Gauge";

// ?dir=rtl switches to Hebrew; ?theme=dark to the dark tokens.
const params = new URLSearchParams(location.search);
const rtl = params.get("dir") === "rtl";
document.documentElement.dir = rtl ? "rtl" : "ltr";
document.documentElement.lang = rtl ? "he" : "en";
if (params.get("theme") === "dark") document.documentElement.setAttribute("data-theme", "dark");

const t = rtl
  ? {
      sender: "hello@example.com", senderSub: "כתובת שולח", aud: "מנויים", audSub: "1,240 אנשים", at: "ו׳ 09:00",
      steps: ["טיוטה", "מתוזמן", "בשליחה", "נשלח"], status: "סטטוס הקמפיין",
      bar: "120 מתוך 140 נשלחו, 3 נכשלו, 8 דולגו", g1: "היום: 310 מתוך 500", g2: "היום: 400 מתוך 500", g3: "היום: 480 מתוך 500",
      file: "contacts.csv", list: "רשימת מנויים", imp: "ייבוא",
    }
  : {
      sender: "hello@example.com", senderSub: "Sender address", aud: "Subscribers", audSub: "1,240 people", at: "Fri 09:00",
      steps: ["Draft", "Scheduled", "Sending", "Sent"], status: "Campaign status",
      bar: "120 of 140 sent, 3 failed, 8 skipped", g1: "Today: 310 of 500", g2: "Today: 400 of 500", g3: "Today: 480 of 500",
      file: "contacts.csv", list: "Subscribers list", imp: "Import",
    };

const card = { padding: 16, border: "1px solid rgb(var(--rule-firm) / .5)", borderRadius: 16, background: "rgb(var(--paper-2))", marginBlockEnd: 16 } as const;
const h = { margin: "0 0 12px", fontSize: "0.8125rem", color: "rgb(var(--ink-soft))" } as const;
const steps = t.steps.map((label, i) => ({ id: String(i), label }));

function Demo() {
  return (
    <main style={{ padding: 16, maxWidth: 560, margin: "0 auto", background: "rgb(var(--paper))", minHeight: "100vh", color: "rgb(var(--ink))" }}>
      <section style={card}>
        <h2 style={h}>Journey</h2>
        <Journey from={{ icon: Mail, label: t.sender, sub: t.senderSub }} to={{ icon: Users, label: t.aud, sub: t.audSub }} via={t.at} state="active" />
      </section>
      <section style={card}>
        <h2 style={h}>Journey, waypoint, done and failed</h2>
        <Journey from={{ icon: FileText, label: t.file }} waypoints={[{ icon: Clock, label: t.at }]} to={{ icon: Users, label: t.list }} state="done" />
        <div style={{ height: 20 }} />
        <Journey from={{ icon: FileText, label: t.file }} to={{ icon: Users, label: t.list }} via={t.imp} state="failed" />
      </section>
      <section style={card}>
        <h2 style={h}>LifecycleStepper</h2>
        <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
          <LifecycleStepper steps={steps} current="1" label={t.status} />
          <LifecycleStepper steps={steps} current="2" branch="paused" />
          <LifecycleStepper steps={steps} current="2" branch="failed" />
        </div>
      </section>
      <section style={card}>
        <h2 style={h}>MiniBar</h2>
        <MiniBar parts={[{ value: 120, tone: "ok" }, { value: 3, tone: "danger" }, { value: 8, tone: "muted" }]} total={140} label={t.bar} showNumber />
        <div style={{ height: 12 }} />
        <MiniBar value={3} max={10} showNumber />
        <div style={{ height: 12 }} />
        <MiniBar value={0} max={0} />
      </section>
      <section style={{ ...card, display: "flex", gap: 28, justifyContent: "space-around", paddingBlockEnd: 36 }}>
        <Gauge value={310} max={500} label={t.g1} center={<b>62%</b>} showLevel />
        <Gauge value={400} max={500} label={t.g2} center={<b>80%</b>} showLevel />
        <Gauge value={480} max={500} label={t.g3} center={<b>96%</b>} showLevel />
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Demo />);
