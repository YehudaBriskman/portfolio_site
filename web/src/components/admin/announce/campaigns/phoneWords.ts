import { defineWords, plural } from "@/i18n/words";

/*
 * What only the phone layout of the Campaigns tab says: the filter chips, the
 * sheet, the bulk actions. Everything the desktop already says (statuses,
 * confirm texts, counters) is reused from `words.ts`, so the confirm wording
 * cannot drift between the two layouts.
 */
export const usePhoneCampaignWords = defineWords(
  "adminCampaignsPhone",
  {
    stage: "Stage",
    stages: { draft: "Drafts", live: "Live", done: "Finished" },
    statusFilter: "Status",
    noMatch: "No campaign matches these filters.",
    failedLabel: "Failed",
    progressLabel: "Handled",

    stepperLabel: "Where this campaign is",
    subject: "Subject",
    groupsLabel: "Group",
    toLabel: "Recipients",
    whenLabel: "When",
    countersLabel: "Counts",
    skipped: "Skipped",
    notStarted: "Not started",
    readyHeading: "Before it can go out",
    tested: (when: string) => `Test sent ${when}`,
    notTested: "No test sent yet.",
    needsTestRecipient: "Add a test address in Sender & delivery to send a test.",

    actions: "Actions",
    openDraft: "Edit",
    openCampaign: "Open full view",
    duplicate: "Duplicate",
    copyOf: (name: string) => `Copy of ${name}`.slice(0, 120),
    copied: "Copied as a new draft.",
    copiedMany: (n: number) => plural("en", n, { one: "{n} draft copied.", other: "{n} drafts copied." }),
    copyFailed: "That could not be copied.",

    bulkDelete: "Delete",
    bulkDeleteConfirm: (n: number) => plural("en", n, { one: "Delete {n} draft", other: "Delete {n} drafts" }),
    deletedMany: (n: number) => plural("en", n, { one: "{n} draft deleted.", other: "{n} drafts deleted." }),
    deleteFailed: "Some drafts could not be deleted.",
    selectNote: "Select mode lists drafts only: a campaign that has started cannot be copied or deleted in bulk.",

    moreOptions: "More options",
    reviewAbout: "About this step",
  },
  {
    stage: "שלב",
    stages: { draft: "טיוטות", live: "פעילים", done: "הסתיימו" },
    statusFilter: "מצב",
    noMatch: "אין קמפיין שמתאים לסינון הזה.",
    failedLabel: "נכשלו",
    progressLabel: "טופלו",

    stepperLabel: "היכן הקמפיין נמצא",
    subject: "נושא",
    groupsLabel: "קבוצה",
    toLabel: "נמענים",
    whenLabel: "מתי",
    countersLabel: "ספירות",
    skipped: "דולגו",
    notStarted: "עוד לא התחיל",
    readyHeading: "לפני שאפשר לשלוח",
    tested: (when: string) => `בדיקה נשלחה ${when}`,
    notTested: "עוד לא נשלחה בדיקה.",
    needsTestRecipient: "מוסיפים כתובת לבדיקה בשולח והמסירה כדי לשלוח בדיקה.",

    actions: "פעולות",
    openDraft: "עריכה",
    openCampaign: "פתיחה במסך מלא",
    duplicate: "שכפול",
    copyOf: (name: string) => `עותק של ${name}`.slice(0, 120),
    copied: "הועתק לטיוטה חדשה.",
    copiedMany: (n: number) => plural("he", n, { one: "טיוטה {n} הועתקה.", two: "{n} טיוטות הועתקו.", other: "{n} טיוטות הועתקו." }),
    copyFailed: "לא ניתן להעתיק.",

    bulkDelete: "מחיקה",
    bulkDeleteConfirm: (n: number) => plural("he", n, { one: "מחיקת טיוטה {n}", two: "מחיקת {n} טיוטות", other: "מחיקת {n} טיוטות" }),
    deletedMany: (n: number) => plural("he", n, { one: "טיוטה {n} נמחקה.", two: "{n} טיוטות נמחקו.", other: "{n} טיוטות נמחקו." }),
    deleteFailed: "לא ניתן היה למחוק חלק מהטיוטות.",
    selectNote: "מצב הבחירה מציג טיוטות בלבד: קמפיין שכבר התחיל אי אפשר להעתיק או למחוק בכמות.",

    moreOptions: "אפשרויות נוספות",
    reviewAbout: "על השלב הזה",
  },
);
