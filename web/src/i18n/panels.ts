import { defineWords } from "./words";

/*
 * What the dashboard kit says (ui/Panel, CollapsibleRow, QuickLinks). Shortest
 * accurate words, Hebrew as nouns like `admin.ts`; the PR lists each string
 * for the owner's delegate.
 */
export const usePanelWords = defineWords(
  "panels",
  {
    view: "View",
    expand: "Expand",
    leave: "Back",
    menu: (title: string) => `${title}, menu`,
    loading: "Loading",
    failed: "Could not load",
    expandAll: "Expand all",
    collapseAll: "Collapse all",
    quickLinks: "Quick links",
    edit: "Edit",
    done: "Done",
    pin: (label: string) => `Pin ${label}`,
    unpin: (label: string) => `Unpin ${label}`,
    nothingPinned: "Nothing pinned",
  },
  {
    view: "פתיחה",
    expand: "הרחבה",
    leave: "חזרה",
    menu: (title: string) => `${title}, תפריט`,
    loading: "טוען",
    failed: "לא נטען",
    expandAll: "הרחבת הכול",
    collapseAll: "כיווץ הכול",
    quickLinks: "קיצורים",
    edit: "עריכה",
    done: "סיום",
    pin: (label: string) => `הצמדת ${label}`,
    unpin: (label: string) => `הסרת ${label}`,
    nothingPinned: "אין קיצורים",
  },
);
