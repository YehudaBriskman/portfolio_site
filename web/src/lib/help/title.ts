import type { useHelpWords } from "@/i18n/help";
import type { HelpPage } from "./pages";

type Words = ReturnType<typeof useHelpWords>;

/** A page's title: always an existing heading in i18n/help.ts. */
export function helpTitleOf(w: Words, id: HelpPage): string {
  switch (id) {
    case "language": return w.language;
    case "look": return w.look;
    case "keyboard": return w.keyboard;
    case "sharing": return w.sharing;
    case "rss": return w.rss;
    case "contact-form": return w.contact;
    default: return w.topics[id].title;
  }
}
