import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, CircleAlert, CircleCheck, Keyboard, Languages, Mail, Palette, Rss, Share2 } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import type { Tone } from "@/components/phone/AvatarCircle";
import { HELP_TOPICS } from "@/lib/help/topics";
import type { HelpGuide, HelpPage } from "@/lib/help/pages";

/*
 * What the index and a page's chrome need to know about a page: its title
 * (always an existing heading in i18n/help.ts), and the icon and tint of its
 * row. The icon is the phone's (a leading circle); above 640px the row is a
 * plain link.
 */

const glyph = (g: Parameters<typeof Icon>[0]["icon"]): ReactNode => <Icon icon={g} size={20} data-ph-only="" />;

const GUIDE: Record<HelpGuide, { icon: ReactNode; tone: Tone }> = {
  language: { icon: glyph(Languages), tone: "blue" },
  look: { icon: glyph(Palette), tone: "purple" },
  keyboard: { icon: glyph(Keyboard), tone: "neutral" },
  sharing: { icon: glyph(Share2), tone: "green" },
  rss: { icon: glyph(Rss), tone: "yellow" },
  "contact-form": { icon: glyph(Mail), tone: "blue" },
};

export { helpTitleOf as helpTitle } from "@/lib/help/title";

export function helpRowLook(id: HelpPage): { icon: ReactNode; tone: Tone } {
  if (id in GUIDE) return GUIDE[id as HelpGuide];
  return HELP_TOPICS[id as keyof typeof HELP_TOPICS].kind === "ok"
    ? { icon: glyph(CircleCheck), tone: "green" }
    : { icon: glyph(CircleAlert), tone: "red" };
}

/** The pager's arrows: they mirror in Hebrew, so "next" always points the way the text reads on. */
export const pagerArrow = {
  prev: <Icon icon={ArrowLeft} size={16} mirrorInRtl />,
  next: <Icon icon={ArrowRight} size={16} mirrorInRtl />,
};
