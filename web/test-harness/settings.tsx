/* eslint-disable react-refresh/only-export-components -- entry file, never hot-reloaded */
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Bell, Gauge as GaugeIcon, Mail, Send, Share2 } from "lucide-react";
import "@/index.css";
import "@/styles/popup.css";
import { SettingsList, type SettingsGroupDef } from "@/components/ui/SettingsList";
import { SettingsRow } from "@/components/ui/SettingsRow";

// ?dir=rtl is Hebrew; ?theme=dark; ?open=<group id> opens a group; ?q=<text> fills the search.
const params = new URLSearchParams(location.search);
const rtl = params.get("dir") === "rtl";
document.documentElement.dir = rtl ? "rtl" : "ltr";
document.documentElement.lang = rtl ? "he" : "en";
document.documentElement.setAttribute("data-theme", params.get("theme") === "dark" ? "dark" : "light");

type Doc = { email: boolean; digest: boolean; doi: boolean; unsub: boolean; li: boolean; x: boolean; ig: boolean; mail: boolean; fb: boolean; cap: number };
const initial: Doc = { email: true, digest: false, doi: true, unsub: true, li: true, x: false, ig: true, mail: true, fb: false, cap: 500 };

const t = rtl
  ? {
      title: "הגדרות שיווק",
      g: { everyday: "יומיומי", channels: "ערוצים", sender: "שולח ומשלוח", limits: "מגבלות שליחה", alerts: "התראות" },
      on: "פעיל", off: "כבוי", of5: (n: number) => `${n} מתוך 5 ערוצים`, perDay: (n: number) => `${n} ביום`,
      email: "דיוור באימייל", digest: "סיכום שבועי", doi: "אישור כפול", unsub: "קישור הסרה",
      li: "לינקדאין", x: "X", ig: "אינסטגרם", mail: "אימייל", fb: "פייסבוק",
      emailInfo: "שולח את הפוסטים החדשים למנויים באימייל. כבו אותו כדי להפסיק לשלוח, בלי למחוק את הרשימה. ההגדרה חלה מיד.",
      digestInfo: "במקום מייל לכל פוסט, המנויים מקבלים מייל אחד בשבוע עם כל החדש. מתאים אם מפרסמים הרבה.",
      doiInfo: "כל מנוי חדש מקבל מייל אישור וייכנס לרשימה רק אחרי שילחץ עליו. זה מגן על הרשימה מכתובות שגויות ומהרשמות לא רצויות. מומלץ להשאיר פעיל.",
      unsubInfo: "מוסיף לכל מייל קישור הסרה. נדרש לפי חוק, ולכן כדאי להשאיר פעיל.",
      capLabel: "תקרה יומית", capInfo: "כמה אימיילים אפשר לשלוח ביום. תקרה נמוכה מגינה על המוניטין של השולח בחודשים הראשונים.",
      alertsLabel: "התראה על כשל", alertsInfo: "מייל אליכם כשמשלוח נכשל.",
      warn: "דיוור באימייל פעיל אבל אין כתובת שולח",
    }
  : {
      title: "Marketing settings",
      g: { everyday: "Everyday", channels: "Channels", sender: "Sender and delivery", limits: "Sending limits", alerts: "Alerts" },
      on: "on", off: "off", of5: (n: number) => `${n} of 5 channels`, perDay: (n: number) => `${n} a day`,
      email: "Email newsletter", digest: "Weekly digest", doi: "Double opt-in", unsub: "Unsubscribe link",
      li: "LinkedIn", x: "X", ig: "Instagram", mail: "Email", fb: "Facebook",
      emailInfo: "Sends new posts to subscribers by email. Turn it off to stop sending without deleting the list. It applies at once.",
      digestInfo: "Instead of one email per post, subscribers get a single email each week with everything new. Good if you publish a lot.",
      doiInfo: "Every new subscriber gets a confirmation email and joins the list only after clicking it. This protects the list from typos and unwanted sign-ups. Best left on.",
      unsubInfo: "Adds an unsubscribe link to every email. The law requires it, so leave it on.",
      capLabel: "Daily cap", capInfo: "How many emails can go out in a day. A low cap protects the sender's reputation in the first months.",
      alertsLabel: "Failure alert", alertsInfo: "An email to you when a send fails.",
      warn: "Email is on but there is no sender address",
    };

function Demo() {
  const [doc, setDoc] = useState<Doc>(initial);
  const [open, setOpen] = useState<string | null>(params.get("open"));
  const set = (p: Partial<Doc>) => setDoc((d) => ({ ...d, ...p }));
  const sw = (k: keyof Omit<Doc, "cap">, label: string, info?: string) => (
    <SettingsRow key={k} id={k} kind="switch" label={label} checked={doc[k]} onChange={(v) => set({ [k]: v })} info={info} />
  );
  const channels = ["li", "x", "ig", "mail", "fb"] as const;
  const groups: SettingsGroupDef<Doc>[] = [
    {
      id: "everyday", icon: Bell, title: t.g.everyday, controls: 2,
      items: [{ id: "email", label: t.email, info: t.emailInfo }, { id: "digest", label: t.digest, info: t.digestInfo }],
      summary: (d) => `${d.email ? t.on : t.off}${d.digest ? ` · ${t.digest}` : ""}`,
      warning: (d) => (d.email ? t.warn : null),
      render: () => <>{sw("email", t.email, t.emailInfo)}{sw("digest", t.digest, t.digestInfo)}</>,
    },
    {
      id: "channels", icon: Share2, title: t.g.channels, controls: 5,
      items: channels.map((k) => ({ id: k, label: t[k] })),
      summary: (d) => t.of5(channels.filter((k) => d[k]).length),
      render: () => <>{channels.map((k) => sw(k, t[k]))}</>,
    },
    {
      id: "sender", icon: Send, title: t.g.sender, controls: 2,
      items: [{ id: "doi", label: t.doi, info: t.doiInfo }, { id: "unsub", label: t.unsub, info: t.unsubInfo }],
      summary: (d) => `${t.doi} ${d.doi ? t.on : t.off}`,
      render: () => <>{sw("doi", t.doi, t.doiInfo)}{sw("unsub", t.unsub, t.unsubInfo)}</>,
    },
    {
      id: "limits", icon: GaugeIcon, title: t.g.limits, controls: 1, hasText: true,
      items: [{ id: "cap", label: t.capLabel, info: t.capInfo }],
      summary: (d) => t.perDay(d.cap),
      render: () => (
        <SettingsRow id="cap" kind="value" label={t.capLabel} valueText={String(doc.cap)} info={t.capInfo} onOpen={() => set({ cap: doc.cap === 500 ? 300 : 500 })} />
      ),
    },
    {
      id: "alerts", icon: Mail, title: t.g.alerts, controls: 1,
      items: [{ id: "alert", label: t.alertsLabel, info: t.alertsInfo }],
      summary: () => t.on,
      render: () => <SettingsRow id="alert" kind="switch" label={t.alertsLabel} checked onChange={() => {}} info={t.alertsInfo} />,
    },
  ];
  return (
    <main style={{ padding: 16, maxWidth: 1100, margin: "0 auto", background: "rgb(var(--paper))", minHeight: "100vh", color: "rgb(var(--ink))" }}>
      <h1 style={{ fontSize: "1.5rem", margin: "0 0 16px" }}>{t.title}</h1>
      <SettingsList groups={groups} value={doc} openId={open} onOpenChange={setOpen} />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Demo />);
