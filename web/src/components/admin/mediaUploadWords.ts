import { defineWords } from "@/i18n/words";

/*
 * What the upload box says: the choose button, the sentence about what it
 * takes, and the form that asks what the file shows. Shared by the media
 * page (both layouts) and the picker inside an editor, in the page's own
 * language. The Hebrew is a first draft for the owner's review.
 *
 * The refusals the file check itself writes (`checkFile` in services/media.ts,
 * "is not a JPEG ...") are still English: they carry a file name and a size
 * and are shared with the replace-video form.
 */
type Kind = "image" | "icon" | "video";
const EN_NOUN: Record<Kind, string> = { image: "picture", icon: "icon", video: "video" };
const HE_IN: Record<Kind, string> = { image: "בתמונה", icon: "בסמל", video: "בסרטון" };

export const useMediaUploadWords = defineWords(
  "adminMediaUpload",
  {
    choose: { image: "Choose a picture", icon: "Choose an icon", video: "Choose a video", file: "Choose a file" },
    drop: "or drop one here.",
    limits: {
      image: "Pictures: JPEG, PNG, WebP, AVIF or plain SVG, up to 10 MB.",
      icon: "Icons: SVG or PNG, up to 64 KB.",
      video: "Videos: MP4 or WebM, up to 25 MB and a minute, with a poster.",
    },
    describe: (k: Kind) => `Describe the new ${EN_NOUN[k]}`,
    useAs: "Use it as",
    asPicture: "A picture (resized to AVIF and WebP)",
    asIcon: "An icon (kept as drawn)",
    alt: "Alt text (required)",
    altMissing: (k: Kind) => `Say what the ${EN_NOUN[k]} shows before uploading.`,
    altHint: (k: Kind) => `What the ${EN_NOUN[k]} shows, for someone who cannot see it.`,
    poster: "Poster image (required)",
    posterHint: "A still from the video. JPEG, PNG, WebP or AVIF, up to 5 MB.",
    captions: "Captions (optional)",
    captionsHint: "A WebVTT (.vtt) file.",
    captionsLang: "Captions language",
    caption: "Caption",
    credit: "Credit",
    note: {
      video: "Location, device and date tags are removed on upload. It plays muted, and never by itself with motion off.",
      icon: "Kept as drawn. An SVG with scripts, events or outside links is refused; a one-colour one takes the text colour.",
      image: "Location and camera data are removed on upload. AVIF and WebP sizes are made from it.",
    },
    uploading: "Uploading",
    upload: "Upload",
    cancel: "Cancel",
    posterRequired: "Choose a poster image: it is what shows before the video plays, and instead of it with motion off.",
    uploadFailed: "Upload failed",
    notOneOf: (name: string, says: string) => `${name} is not one of: ${says}.`,
    kindsMany: { image: "pictures", icon: "icons", video: "videos" },
    /* The picker an editor field opens, and the grid it shares with the library page. */
    lib: {
      choose: "Choose from library",
      title: "Media library",
      iconsTitle: "Icons",
      media: "Media",
      many: { image: "Pictures", icon: "Icons", video: "Videos" },
      one: { image: "Picture", icon: "Icon", video: "Video" },
      all: "All",
      show: "Show",
      search: "Search",
      searchHint: "Alt text, caption, file name",
      loading: (what: string) => `Loading ${what}`,
      loadingShort: "Loading…",
      count: (n: number, what: string) => `${n} ${what}`,
      none: (what: string) => `There are no ${what} in the library yet. Upload the first above.`,
      noMatch: "Nothing matches that search.",
      unused: "unused",
      used: (n: number) => `used ${n}×`,
      from: "From the library:",
      loadFailed: "Failed to load",
    },
  },
  {
    choose: { image: "בחירת תמונה", icon: "בחירת סמל", video: "בחירת סרטון", file: "בחירת קובץ" },
    drop: "או גררו קובץ לכאן.",
    limits: {
      image: "תמונות: JPEG, PNG, WebP, AVIF או SVG פשוט, עד 10 MB.",
      icon: "סמלים: SVG או PNG, עד 64 KB.",
      video: "סרטונים: MP4 או WebM, עד 25 MB ודקה, עם תמונת תצוגה.",
    },
    describe: (k: Kind) => ({ image: "תיאור התמונה החדשה", icon: "תיאור הסמל החדש", video: "תיאור הסרטון החדש" })[k],
    useAs: "שימוש בקובץ בתור",
    asPicture: "תמונה (מוקטנת ל־AVIF ול־WebP)",
    asIcon: "סמל (נשמר כפי שצויר)",
    alt: "טקסט חלופי (חובה)",
    altMissing: (k: Kind) => `כתבו מה מוצג ${HE_IN[k]} לפני ההעלאה.`,
    altHint: (k: Kind) => `מה מוצג ${HE_IN[k]}, למי שלא יכול לראות.`,
    poster: "תמונת תצוגה (חובה)",
    posterHint: "תמונה מתוך הסרטון. JPEG, PNG, WebP או AVIF, עד 5 MB.",
    captions: "כתוביות (לא חובה)",
    captionsHint: "קובץ WebVTT (‎.vtt‎).",
    captionsLang: "שפת הכתוביות",
    caption: "כיתוב",
    credit: "קרדיט",
    note: {
      video: "תגיות מיקום, מכשיר ותאריך מוסרות בהעלאה. הסרטון מנוגן ללא קול, ואף פעם לא מעצמו כשהתנועה כבויה.",
      icon: "נשמר כפי שצויר. SVG עם סקריפטים, אירועים או קישורים חיצוניים נדחה; סמל חד־צבעי מקבל את צבע הטקסט.",
      image: "נתוני מיקום ומצלמה מוסרים בהעלאה. גדלי AVIF ו־WebP נוצרים ממנו.",
    },
    uploading: "מעלה",
    upload: "העלאה",
    cancel: "ביטול",
    posterRequired: "בחרו תמונת תצוגה: היא מוצגת לפני שהסרטון מתנגן, ובמקומו כשהתנועה כבויה.",
    uploadFailed: "ההעלאה נכשלה",
    notOneOf: (name: string, says: string) => `${name} אינו אחד מאלה: ${says}.`,
    kindsMany: { image: "תמונות", icon: "סמלים", video: "סרטונים" },
    lib: {
      choose: "בחירה מהספרייה",
      title: "ספריית המדיה",
      iconsTitle: "סמלים",
      media: "מדיה",
      many: { image: "תמונות", icon: "סמלים", video: "סרטונים" },
      one: { image: "תמונה", icon: "סמל", video: "סרטון" },
      all: "הכול",
      show: "הצגה",
      search: "חיפוש",
      searchHint: "טקסט חלופי, כיתוב, שם קובץ",
      loading: (what: string) => `טוען ${what}`,
      loadingShort: "טוען…",
      count: (n: number, what: string) => `${n} ${what}`,
      none: (what: string) => `עדיין אין ${what} בספרייה. העלו את הראשון למעלה.`,
      noMatch: "שום דבר לא תואם לחיפוש.",
      unused: "לא בשימוש",
      used: (n: number) => `בשימוש ${n}×`,
      from: "מהספרייה:",
      loadFailed: "הטעינה נכשלה",
    },
  },
);

export type UploadKind = Kind;
