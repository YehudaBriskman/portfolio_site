import { defineWords } from "./words";

/*
 * The share menu's words (#470). Brand names (LinkedIn, Gmail, X, WhatsApp,
 * Instagram) are not here: they are names, drawn as such in both languages.
 */
export const useShareWords = defineWords(
  "share",
  {
    share: "Share",
    shareNamed: (title: string) => `Share "${title}"`,
    copyLink: "Copy link",
    email: "Email",
    saveImage: "Save image",
    saveImageFor: "for",
    newTab: "opens in a new tab",
    linkCopied: "Link copied",
    captionCopied: "Caption copied. Paste it into your post.",
    imageSaved: "Image saved and caption copied. Attach the image in the app.",
    copyFailed: "Couldn’t copy. The address is in the address bar.",
    saveFailed: "Couldn’t save the image.",
  },
  {
    share: "שיתוף",
    shareNamed: (title: string) => `שיתוף "${title}"`,
    copyLink: "העתקת קישור",
    email: "אימייל",
    saveImage: "שמירת תמונה",
    saveImageFor: "עבור",
    newTab: "נפתח בלשונית חדשה",
    linkCopied: "הקישור הועתק",
    captionCopied: "הטקסט הועתק. הדביקו אותו בחלון השיתוף.",
    imageSaved: "התמונה נשמרה והטקסט הועתק. צרפו את התמונה באפליקציה.",
    copyFailed: "ההעתקה נכשלה. הכתובת מופיעה בשורת הכתובת.",
    saveFailed: "שמירת התמונה נכשלה.",
  },
);
