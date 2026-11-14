import { useEffect, type ReactNode } from "react";
import "@/components/phone/tokens.css";
import styles from "@/components/phone/phone.module.css";

/**
 * The page's one primary action, pinned to the bottom of the screen on a
 * phone, above the home indicator (`env(safe-area-inset-bottom)`). It is the
 * same link as the one in the header (same URL, same words): the header's is
 * hidden on a phone and this is hidden above 640px, so there is exactly one
 * of it on any screen. It sits last in the DOM, so a keyboard reaches it
 * after the content. The document gets matching bottom padding
 * (`--ph-pinned-space`), so it never covers the last line.
 *
 * Opaque, no blur, no shadow beyond a hairline.
 */
export default function PinnedAction({ href, children }: { href: string; children: ReactNode }) {
  /* The footer takes the room (CSS reads this flag), so the end of the page is
     never under the button. Cleared on unmount: another page has no pin. */
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-has-pinned", "");
    return () => root.removeAttribute("data-has-pinned");
  }, []);
  return (
    <div className={styles.pinned} data-phone-pinned="">
      <a href={href} className={styles.pinnedLink} data-phone="pinned-action" rel="noopener noreferrer">
        {children}
      </a>
    </div>
  );
}
