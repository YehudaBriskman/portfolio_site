import { defineWords } from "@/i18n/words";

/* The Marketing header's line, per tab: Inbox is posted by hand, Campaigns is the one place mail is sent. */
export const useHubIntro = defineWords(
  "adminHubIntro",
  {
    inbox: "What is new on the site, ready to post. Pick one, read how it will look, adjust the caption and copy it. You post it yourself.",
    audience: "The people who asked for your mail, and the groups you send to.",
    campaigns: "Sends email to your subscribers, and only when you confirm it.",
    library: "Caption templates and snippets you reuse.",
    settings: "How captions are made, and who your campaign mail comes from.",
  },
  {
    inbox: "מה חדש באתר, מוכן לפרסום. בוחרים פריט, רואים איך הוא ייראה, מתאימים את הכיתוב ומעתיקים. מפרסמים בעצמכם.",
    audience: "האנשים שביקשו לקבל אימייל מכם, והקבוצות שאליהן שולחים.",
    campaigns: "שולח אימייל למנויים שלכם, ורק אחרי שמאשרים.",
    library: "תבניות כיתוב וקטעים שחוזרים עליהם.",
    settings: "איך נוצרים הכיתובים, ומי השולח של אימיילי הקמפיין.",
  },
);
