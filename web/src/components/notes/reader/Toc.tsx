import { useEffect, useState, type RefObject } from "react";
import { scrollToAnchor } from "@/lib/scrollToAnchor";
import styles from "./Reader.module.css";

/*
 * A note's table of contents, tracking the heading being read (#249).
 *
 * Two things borrowed from Bothy's `Toc`, with its reasons:
 *
 *  - IT READS THE RENDERED DOM, not the markdown. `rehypeHeadingIds` already
 *    gives every h2–h4 its id while rendering, so the outline is exactly the
 *    headings the page has, in order, with the ids their copy-links use; a
 *    second parse would be a second slugger to keep in step. A
 *    MutationObserver re-reads when the body changes (the highlighter's
 *    second render, a lazy picture), compared by value so an unrelated change
 *    does not re-render the list.
 *  - NOT AN IntersectionObserver for the current heading. IO reports headings
 *    crossing a band, so in a section taller than the window nothing crosses
 *    anything and the highlight sticks or clears. The question is "which is
 *    the last heading above the reading line", and it has an answer at every
 *    scroll position; it is measured on scroll, one measurement a frame. It
 *    is a readout, so it runs under every motion off-switch, like the
 *    reading bar (`docs/motion-contract.md` §8).
 *
 * `aria-current="location"` marks the current entry for a screen reader as
 * well as by weight.
 */

export type Heading = { id: string; text: string; level: number };

/* Where a heading counts as "being read": below where a jump to it lands
   (the nav's scroll padding plus the heading's own scroll margin, ~184px),
   and a quarter of the way down a tall window. */
const line = () => Math.max(200, window.innerHeight * 0.25);

export function useHeadings(box: RefObject<HTMLElement | null>, key: string): Heading[] {
  const [heads, setHeads] = useState<Heading[]>([]);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const read = () => {
      const next = Array.from(el.querySelectorAll<HTMLElement>("h2[id], h3[id], h4[id]")).map((h) => ({
        id: h.id,
        text: h.textContent?.trim() ?? "",
        level: Number(h.tagName.slice(1)),
      }));
      setHeads((prev) =>
        prev.length === next.length && prev.every((p, i) => p.id === next[i].id && p.text === next[i].text) ? prev : next,
      );
    };
    read();
    if (typeof MutationObserver === "undefined") return;
    const mo = new MutationObserver(read);
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    return () => mo.disconnect();
  }, [box, key]);
  return heads;
}

export function useActiveHeading(headings: Heading[]): string {
  const [active, setActive] = useState("");
  useEffect(() => {
    if (headings.length === 0) return;
    let timer = 0;
    const measure = () => {
      timer = 0;
      let current = "";
      const at = line();
      for (const h of headings) {
        const el = document.getElementById(h.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= at) current = h.id;
        else break;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!timer) timer = window.setTimeout(measure, 60);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (timer) window.clearTimeout(timer);
    };
  }, [headings]);
  return headings.some((h) => h.id === active) ? active : "";
}

export default function Toc({
  headings,
  active,
  label,
  onPick,
}: {
  headings: Heading[];
  active: string;
  label: string;
  onPick?: () => void;
}) {
  if (headings.length === 0) return null;
  const top = Math.min(...headings.map((h) => h.level));
  return (
    <nav aria-label={label} className={styles.toc}>
      <p className={styles.panelTitle} aria-hidden="true">
        {label}
      </p>
      <ol className={styles.tocList}>
        {headings.map((h) => (
          <li key={h.id} style={{ paddingInlineStart: `${(h.level - top) * 0.85}rem` }}>
            <a
              href={`#${encodeURIComponent(h.id)}`}
              className={styles.tocLink}
              aria-current={h.id === active ? "location" : undefined}
              onClick={(e) => {
                onPick?.();
                /* Scrolls and moves focus, so the next Tab is inside the
                   section; a missing id falls through to the browser. */
                if (scrollToAnchor(h.id)) {
                  e.preventDefault();
                  window.history.replaceState(window.history.state, "", `#${encodeURIComponent(h.id)}`);
                }
              }}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
