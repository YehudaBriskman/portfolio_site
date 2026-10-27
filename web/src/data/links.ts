/* GitHub and LinkedIn only. Personal social accounts on a hiring surface can
   lose points and never win any. */

/**
 * The lucide icon each profile is drawn with.
 *
 * A union rather than a bare `string`, so the nav's icon lookup is exhaustive
 * at compile time: adding a profile here without giving the chrome something
 * to draw it with is now a type error rather than a blank 44px hole in the
 * island that nobody notices until it ships.
 */
export type LinkIcon = "Github" | "Linkedin";

export type SocialLink = {
  /** Lowercase key; the footer prints it with a `capitalize` rule. */
  name: string;
  url: string;
  icon: LinkIcon;
  /**
   * The name a screen reader reads, written the way the company writes it.
   * The footer's `capitalize` produces "Github", which is nobody's spelling
   * of GitHub; an icon-only button in the nav has nothing but this label, so
   * it is worth getting right where it is the only text there is.
   */
  label: string;
};

export const links: SocialLink[] = [
  { name: "github", url: "https://github.com/YehudaBriskman", icon: "Github", label: "GitHub" },
  {
    name: "linkedin",
    url: "https://www.linkedin.com/in/yehuda-briskman-ab923b2b8",
    icon: "Linkedin",
    label: "LinkedIn",
  },
];
