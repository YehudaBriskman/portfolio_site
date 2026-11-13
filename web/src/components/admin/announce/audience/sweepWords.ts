import { defineWords } from "@/i18n/words";

/* The list-hygiene note on the Audience tab. Hebrew follows the glossary. */
export const useSweepWords = defineWords(
  "adminSweep",
  {
    title: "Unconfirmed signups",
    body: (days: number, last: number, total: number, since: string) =>
      `Signups nobody confirmed are deleted automatically after ${days} days. Last run removed ${last}; ${total} in all since ${since}.`,
    none: (days: number) => `Signups nobody confirmed are deleted automatically after ${days} days. Nothing has been removed yet.`,
    lastRun: (when: string) => `Last run: ${when}`,
  },
  {
    title: "הרשמות שלא אושרו",
    body: (days: number, last: number, total: number, since: string) =>
      `הרשמות שאיש לא אישר נמחקות אוטומטית אחרי ${days} ימים. בריצה האחרונה נמחקו ${last}; בסך הכול ${total} מאז ${since}.`,
    none: (days: number) => `הרשמות שאיש לא אישר נמחקות אוטומטית אחרי ${days} ימים. עדיין לא נמחק דבר.`,
    lastRun: (when: string) => `הריצה האחרונה: ${when}`,
  },
);
