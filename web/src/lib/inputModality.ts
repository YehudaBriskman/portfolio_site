/*
 * Last input modality: "keyboard" or "pointer" (mouse, touch, pen).
 *
 * Why this exists (#776)
 * ----------------------
 * `RouteAnnouncer` moves focus to the new page's heading so a screen reader
 * and a keyboard user land on it. The browser then decides whether that script
 * focus paints a `:focus-visible` ring, and its heuristic is not "was the last
 * input a key": Chromium (and WebKit on iOS) also match `:focus-visible` when
 * nothing was focused before the script call, which is the normal state after
 * tapping a link that then unmounts. So a tap on a project card left a thick
 * ring round the title, on a phone, for a person who never touched a keyboard.
 *
 * The browser cannot be asked for the thing that matters, so this tracks it:
 * `<html data-input="keyboard|pointer">`, flipped by the last real input. One
 * CSS rule at the end of index.css hides the ring only while the modality is
 * "pointer" (and never in forced-colors, never on text fields). Focus itself is
 * untouched: screen readers still land on the heading.
 *
 * Default is "pointer": before any input nothing has asked for a ring, and the
 * first Tab flips it before the browser paints the focused element.
 */
export type InputModality = "keyboard" | "pointer";

const ATTR = "data-input";

/** Keys that move or activate focus. Modifier-only presses and browser
 *  shortcuts (Ctrl/Cmd/Alt + key) are not keyboard navigation. */
export function isNavigationKey(e: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey">): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  return e.key !== "Shift" && e.key !== "Control" && e.key !== "Alt" && e.key !== "Meta" && e.key !== "CapsLock";
}

export function setModality(m: InputModality, root: HTMLElement = document.documentElement): void {
  if (root.getAttribute(ATTR) !== m) root.setAttribute(ATTR, m);
}

export function getModality(root: HTMLElement = document.documentElement): InputModality {
  return root.getAttribute(ATTR) === "keyboard" ? "keyboard" : "pointer";
}

/** Install the listeners once (capture, so nothing can stop them). Returns a disposer. */
export function installInputModality(doc: Document = document): () => void {
  const root = doc.documentElement;
  setModality("pointer", root);
  const key = (e: KeyboardEvent) => {
    if (isNavigationKey(e)) setModality("keyboard", root);
  };
  const point = () => setModality("pointer", root);
  const opts = { capture: true, passive: true } as const;
  doc.addEventListener("keydown", key, opts);
  for (const t of ["pointerdown", "mousedown", "touchstart"] as const) doc.addEventListener(t, point, opts);
  return () => {
    doc.removeEventListener("keydown", key, opts);
    for (const t of ["pointerdown", "mousedown", "touchstart"] as const) doc.removeEventListener(t, point, opts);
  };
}
