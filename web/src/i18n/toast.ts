import { defineWords } from "./words";

/*
 * The words of the toast service (`lib/toast`, `components/ui/ToastHost`):
 * the buttons on a toast and the notifications list. The text of a toast
 * itself belongs to whoever raises it. The Hebrew is a first draft for the
 * owner's review.
 */
export const useToastWords = defineWords(
  "toast",
  {
    undo: "Undo",
    retry: "Retry",
    details: "Details",
    hideDetails: "Hide details",
    dismiss: "Dismiss",
    region: "Notifications",
    notifications: "Notifications",
    notificationsUnread: (n: number) => (n === 1 ? "Notifications, 1 new" : `Notifications, ${n} new`),
    none: "Nothing yet this session.",
    clear: "Clear",
    kind: { success: "Done", info: "Note", warning: "Warning", error: "Problem", loading: "Working" },
  },
  {
    undo: "ביטול",
    retry: "נסו שוב",
    details: "פרטים",
    hideDetails: "הסתרת פרטים",
    dismiss: "סגירה",
    region: "התראות",
    notifications: "התראות",
    notificationsUnread: (n: number) => (n === 1 ? "התראות, אחת חדשה" : `התראות, ${n} חדשות`),
    none: "עדיין אין כלום בסשן הזה.",
    clear: "ניקוי",
    kind: { success: "בוצע", info: "הערה", warning: "אזהרה", error: "תקלה", loading: "בעבודה" },
  },
);
