import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { Download, Plus } from "lucide-react";
import "@/index.css";
import "@/styles/popup.css";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { Banner } from "@/components/ui/Banner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

/* The words below are fixture text for the screenshots, not product strings. */
const he = new URLSearchParams(location.search).get("lang") === "he";
const T = he
  ? {
      title: "קמפיינים", back: "שיווק", desc: "כל מה שנשלח ומה שממתין לשליחה.", info: "קמפיין הוא גיליון אחד שנשלח לרשימה אחת. אפשר להשהות שליחה בכל רגע.",
      status: "טיוטה נשמרה לפני רגע", primary: "קמפיין חדש", secondary: "ייצוא", more: "עוד פעולות", actions: "פעולות העמוד",
      m1: "הרכבת גיליון", m2: "השהיית כל השליחות", tabs: "חלקי הקמפיין", t1: "תיבת דואר", t2: "קהל", t3: "ספרייה", t4: "הגדרות שולח ארוכות מאוד לבדיקה", t5: "ארכיון",
      warnT: "השליחה מושהית", warn: "שום דבר לא יוצא עד שתמשיך.", resume: "המשך שליחה", dismiss: "סגירה", info1: "יש טיוטה שממתינה לך.", dang: "השליחה נכשלה ל-3 נמענים.", retry: "ניסיון חוזר",
      ctitle: "למחוק 3 פוסטים?", ctext: "שלושת הפוסטים שנבחרו והתרגומים שלהם יימחקו לצמיתות.", cdel: "מחיקת 3 פוסטים", keep: "להשאיר", open: "פתיחת הדיאלוג",
      body: "תוכן הלשונית הפעילה",
    }
  : {
      title: "Campaigns", back: "Marketing", desc: "Everything that went out and what is waiting to be sent.", info: "A campaign is one issue sent to one list. You can pause sending at any moment.",
      status: "Draft saved a moment ago", primary: "New campaign", secondary: "Export", more: "More actions", actions: "Page actions",
      m1: "Compile issue", m2: "Pause all sending", tabs: "Campaign sections", t1: "Inbox", t2: "Audience", t3: "Library", t4: "Sender settings with a very long name to test", t5: "Archive",
      warnT: "Sending is paused", warn: "Nothing goes out until you resume.", resume: "Resume sending", dismiss: "Dismiss", info1: "A draft is waiting for you.", dang: "Sending failed for 3 recipients.", retry: "Retry",
      ctitle: "Delete 3 posts?", ctext: "The 3 selected posts and their translations are removed for good.", cdel: "Delete 3 posts", keep: "Keep", open: "Open the dialog",
      body: "Content of the active tab",
    };

/* ?newmenu=1 draws the split New button; on a phone its caret opens the bottom sheet (#864 shots). The kit words follow the document's language. */
const params = new URLSearchParams(location.search);
document.documentElement.lang = he ? "he" : "en";
document.documentElement.dir = he ? "rtl" : "ltr";

function Gallery() {
  const [tab, setTab] = useState("audience");
  const [confirm, setConfirm] = useState(new URLSearchParams(location.search).get("confirm") === "1");
  return (
    <div className="a-app" style={{ padding: "1rem", minHeight: "100dvh", background: "rgb(var(--paper))" }}>
      <PageHeader
        title={T.title}
        back={{ label: T.back, href: "/admin" }}
        description={T.desc}
        info={T.info}
        status={T.status}
        actionsLabel={T.actions}
        moreLabel={T.more}
        primary={{ id: "new", label: T.primary, icon: Plus, onSelect: () => {} }}
        newMenu={params.get("newmenu") === "1"}
        secondary={{ id: "export", label: T.secondary, icon: Download, onSelect: () => {} }}
        more={[
          { id: "c", label: T.m1, onSelect: () => {} },
          { id: "p", label: T.m2, onSelect: () => {} },
        ]}
      />
      <Banner tone="warning" title={T.warnT} action={{ label: T.resume, onSelect: () => {} }} dismissLabel={T.dismiss} onDismiss={() => {}}>
        {T.warn}
      </Banner>
      <Banner tone="info" dismissLabel={T.dismiss} onDismiss={() => {}}>
        {T.info1}
      </Banner>
      <Banner tone="danger" action={{ label: T.retry, onSelect: () => {} }}>
        {T.dang}
      </Banner>
      <Tabs
        value={tab}
        onValueChange={setTab}
        label={T.tabs}
        idBase="g"
        panels
        items={[
          { id: "inbox", label: T.t1, count: 3 },
          { id: "audience", label: T.t2 },
          { id: "library", label: T.t3 },
          { id: "sender", label: T.t4 },
          { id: "archive", label: T.t5, count: 120 },
        ]}
      />
      <TabPanel idBase="g" id="audience" value={tab}>
        <p style={{ padding: "1rem 0" }}>{T.body}</p>
      </TabPanel>
      <button type="button" className="a-btn" onClick={() => setConfirm(true)}>
        {T.open}
      </button>
      <ConfirmDialog open={confirm} title={T.ctitle} confirm={T.cdel} cancel={T.keep} onConfirm={() => setConfirm(false)} onCancel={() => setConfirm(false)}>
        {T.ctext}
      </ConfirmDialog>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MemoryRouter>
      <Gallery />
    </MemoryRouter>
  </StrictMode>,
);
