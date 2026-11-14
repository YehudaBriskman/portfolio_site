import { useEffect, useState } from "react";

/*
 * Is a soft keyboard up over the page?
 *
 * Chrome on Android and Safari on iOS both leave the layout viewport alone
 * when the keyboard opens and shrink only the visual one. A `position: fixed`
 * bar stays where the layout viewport ends, which is either under the keyboard
 * (unreachable) or, where the layout does shrink, glued over the field being
 * typed in. Either way it is no use while typing, so the editor bar steps
 * aside until the keyboard closes. The test is the visual viewport's lost
 * height, and only while a text control has focus, so the browser's own
 * address bar collapsing (about 56px) never counts.
 */

/** Taller than any address bar, shorter than any keyboard. */
export const KEYBOARD_MIN_PX = 120;

export function keyboardOpen(
  vv: { height: number; offsetTop: number; scale?: number } | null | undefined,
  innerHeight: number,
  typing: boolean,
): boolean {
  if (!vv || !typing) return false;
  // Pinch-zoom shrinks the visual viewport just as a keyboard does; only an unzoomed one can be read.
  if ((vv.scale ?? 1) > 1.01) return false;
  return innerHeight - vv.height - vv.offsetTop > KEYBOARD_MIN_PX;
}

export function isTextControl(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) {
    return !["button", "checkbox", "radio", "range", "color", "file", "submit", "reset", "image"].includes(el.type);
  }
  return false;
}

export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const check = () => setOpen(keyboardOpen(vv, window.innerHeight, isTextControl(document.activeElement)));
    vv.addEventListener("resize", check);
    vv.addEventListener("scroll", check);
    document.addEventListener("focusin", check);
    document.addEventListener("focusout", check);
    return () => {
      vv.removeEventListener("resize", check);
      vv.removeEventListener("scroll", check);
      document.removeEventListener("focusin", check);
      document.removeEventListener("focusout", check);
    };
  }, []);
  return open;
}
