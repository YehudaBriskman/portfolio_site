import { useEffect, type ReactNode } from "react";
/* Dock first: its stylesheet then comes before the kit's, so the kit's
   `.pinned` (display: none above 640px) outranks the Dock's `display: flex`. */
import { Dock } from "@/components/ui/Dock";
import "@/components/phone/tokens.css";
import styles from "@/components/phone/phone.module.css";

/**
 * The page's one primary action, floating at the bottom of a phone as a
 * `ui/Dock` pill: an opaque raised surface with a hairline and one shadow,
 * `env(safe-area-inset-bottom) + 12px` from the bottom, so it cannot blend
 * with the page in light or dark. The action inside it is a solid accent
 * pill. It is the same link as the one in the header (same URL, same words):
 * the header's is not drawn on a phone and this is not drawn above 640px, so
 * there is exactly one of it on any screen. It sits last in the DOM, so a
 * keyboard reaches it after the content. The footer gets matching room
 * (`data-has-pinned`), so the pill never covers the last line.
 *
 * `label` names the group (the page's own title).
 */
export default function PinnedAction({ href, label, children }: { href: string; label: string; children: ReactNode }) {
  /* The footer takes the room (CSS reads this flag), so the end of the page is
     never under the pill. Cleared on unmount: another page has no pin. */
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-has-pinned", "");
    return () => root.removeAttribute("data-has-pinned");
  }, []);
  return (
    <Dock label={label} className={styles.pinned} data-phone-pinned="">
      <a href={href} className={styles.pinnedLink} data-phone="pinned-action" rel="noopener noreferrer">
        {children}
      </a>
    </Dock>
  );
}
