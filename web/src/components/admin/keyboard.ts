import { useEffect, useRef, useState } from "react";

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

/* ───────────────────────────────────────────────────── shortcut registry (A32, M12)
 *
 * One document listener and one table, so two shortcuts cannot quietly claim
 * the same keys: a second registration of a combo another id holds throws.
 * `mod` is Ctrl on Windows and Linux and Cmd on a Mac. A letter matches by
 * `key` or by physical `code`, so Ctrl+K still works on a Hebrew layout, where
 * `key` is "ל". `fields` says where it is live: "none" = never while a text
 * control or a rich-text field has focus (Ctrl+B is bold there), "plain" = in a
 * plain input or textarea too, but not in a rich-text field (Ctrl+K is a link
 * there). Whatever already handled the event (`defaultPrevented`) wins.
 */

export type Shortcut = {
  id: string;
  /** One letter, or a named key as `KeyboardEvent.key` spells it. */
  key: string;
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
  fields: "none" | "plain";
  run: (e: KeyboardEvent) => void;
  enabled?: () => boolean;
};

const inRichText = (t: EventTarget | null): boolean => t instanceof HTMLElement && (t.isContentEditable || !!t.closest("[contenteditable='true']"));

/** A text control or a rich-text field has focus. */
export const typingIn = (t: EventTarget | null): boolean =>
  t instanceof HTMLElement && (inRichText(t) || /^(input|textarea|select)$/i.test(t.tagName));

/** The stable name of a combo, `mod+shift+k`. */
export const comboOf = (s: Pick<Shortcut, "key" | "mod" | "shift" | "alt">): string =>
  [s.mod && "mod", s.shift && "shift", s.alt && "alt", s.key.toLowerCase()].filter(Boolean).join("+");

export function shortcutMatches(s: Shortcut, e: KeyboardEvent): boolean {
  if (!!s.mod !== (e.ctrlKey || e.metaKey) || !!s.shift !== e.shiftKey || !!s.alt !== e.altKey) return false;
  const k = s.key.toLowerCase();
  return e.key.toLowerCase() === k || (/^[a-z]$/.test(k) && e.code === `Key${k.toUpperCase()}`);
}

const table = new Map<string, Shortcut>();
let installed = false;

function onKeyDown(e: KeyboardEvent) {
  if (e.defaultPrevented || e.isComposing) return;
  for (const s of table.values()) {
    if (!shortcutMatches(s, e) || s.enabled?.() === false) continue;
    if (s.fields === "none" ? typingIn(e.target) : inRichText(e.target)) continue;
    e.preventDefault();
    s.run(e);
    return;
  }
}

export function registerShortcut(s: Shortcut): () => void {
  const combo = comboOf(s);
  for (const o of table.values()) {
    if (o.id !== s.id && comboOf(o) === combo) throw new Error(`shortcut ${combo} is taken by "${o.id}", cannot register "${s.id}"`);
  }
  table.set(s.id, s);
  if (!installed && typeof document !== "undefined") {
    document.addEventListener("keydown", onKeyDown);
    installed = true;
  }
  return () => {
    if (table.get(s.id) === s) table.delete(s.id);
    if (!table.size && installed) {
      document.removeEventListener("keydown", onKeyDown);
      installed = false;
    }
  };
}

export const listShortcuts = (): Shortcut[] => [...table.values()];

/** Registers while mounted; `run` and `enabled` may change every render. */
export function useShortcut(s: Shortcut | null): void {
  const latest = useRef(s);
  useEffect(() => {
    latest.current = s;
  });
  const id = s?.id;
  const combo = s ? comboOf(s) : "";
  const fields = s?.fields;
  useEffect(() => {
    const base = latest.current;
    if (!id || !base) return;
    return registerShortcut({
      ...base,
      run: (e) => latest.current?.run(e),
      enabled: () => latest.current?.enabled?.() !== false,
    });
  }, [id, combo, fields]);
}

/** Cmd on a Mac, Ctrl elsewhere: the name to show beside a shortcut. */
export function modLabel(): string {
  return typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent || "") ? "⌘" : "Ctrl";
}
