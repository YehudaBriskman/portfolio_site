import { defineWords } from "@/i18n/words";

/* The banner over the Audience and Campaigns tabs. Hebrew follows the glossary: a campaign is קמפיין, a backup is גיבוי. */
export const useLedgerWords = defineWords(
  "adminLedger",
  {
    repairedTitle: "People who asked not to be mailed were put back",
    repairedBody: (u: number, s: number, e: number) =>
      `The sender found people marked active who had unsubscribed (${u}), been blocked (${s}) or been erased (${e}), and restored their choice. This usually means the database was restored from a backup. Look over the audience, then confirm. Nobody on the list was mailed.`,
    repairedAt: (when: string) => `Last repair: ${when}`,
    acknowledge: "I have checked",
    acknowledging: "Saving…",
    acknowledgeFailed: "That could not be saved. Try again.",
    downTitle: "The never-mail list cannot be read",
    downBody: "No campaign will send until it can be read. Contacts and signups still work. Check that its database exists and that the server can reach it.",
  },
  {
    repairedTitle: "אנשים שביקשו לא לקבל דואר הוחזרו למצבם",
    repairedBody: (u: number, s: number, e: number) =>
      `השולח מצא אנשים שסומנו כפעילים אף שהסירו את עצמם (${u}), נחסמו (${s}) או נמחקו (${e}), והחזיר את בחירתם. בדרך כלל זה אומר שמסד הנתונים שוחזר מגיבוי. עברו על הקהל ואז אשרו. לאיש מהרשימה לא נשלח דואר.`,
    repairedAt: (when: string) => `התיקון האחרון: ${when}`,
    acknowledge: "בדקתי",
    acknowledging: "שומר…",
    acknowledgeFailed: "לא ניתן היה לשמור. נסו שוב.",
    downTitle: "אי אפשר לקרוא את רשימת האסורים לדיוור",
    downBody: "שום קמפיין לא יישלח עד שאפשר יהיה לקרוא אותה. אנשי קשר והרשמות ממשיכים לעבוד. בדקו שמסד הנתונים שלה קיים ושהשרת מגיע אליו.",
  },
);
