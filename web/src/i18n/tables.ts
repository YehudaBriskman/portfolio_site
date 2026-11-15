import { defineWords } from "./words";

/*
 * The words of the table kit (#860): the density switch, the columns and
 * customise-actions menus, the in-cell edit and the New menu. Shortest accurate
 * words; the Hebrew is a first draft for the owner's review.
 */
export const useTableWords = defineWords(
  "tables",
  {
    density: { label: "Row height", compact: "Compact", cozy: "Cozy", comfy: "Comfy" },
    columns: "Columns",
    showAll: "Show all",
    actions: "Customise actions",
    actionsHint: (n: number) => `Show up to ${n}. The rest go in More.`,
    reset: "Reset",
    edit: (field: string) => `Edit ${field}`,
    saved: "Saved",
    views: "Views",
    saveView: "Save view",
    newMenu: { label: "New", more: "More to create", create: "Create", recent: "Recent", hint: "finds anything" },
  },
  {
    density: { label: "גובה שורה", compact: "צפוף", cozy: "רגיל", comfy: "מרווח" },
    columns: "עמודות",
    showAll: "הצגת הכול",
    actions: "התאמת פעולות",
    actionsHint: (n: number) => `עד ${n} מוצגות. השאר ב"עוד".`,
    reset: "איפוס",
    edit: (field: string) => `עריכת ${field}`,
    saved: "נשמר",
    views: "תצוגות",
    saveView: "שמירת תצוגה",
    newMenu: { label: "חדש", more: "עוד ליצור", create: "יצירה", recent: "אחרונים", hint: "מוצא הכול" },
  },
);
