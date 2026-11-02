import { useEffect, useState, type RefObject } from "react";
import styles from "@/components/story/Story.module.css";

/*
 * The year rail: the story page's signature move (#46), and its one frame.
 *
 * A fixed column at the inline start of the window that counts the years as
 * the reader travels them and stamps a mark for each chapter passed. The
 * marks STAY LIT. That is the whole argument for a persistent overlay on a
 * page that otherwise has none: a readout that only ever says where you are
 * is a scrollbar with opinions, while a row of marks that remembers is, by
 * the footer, a record of the walk. Scrolling back up does not un-walk ground
 * the reader has already covered.
 *
 * In the ledger (head of `pages/Story.tsx`) this is `tally`, and like the
 * home page's section heads and its dark ground it is a FRAME, not a beat —
 * it is on screen beside every beat rather than being a thing a reader
 * scrolls *to*, so it cannot sit next to one in the sense adjacency means.
 *
 * ONE OBSERVER, NO SCROLL LISTENER
 * --------------------------------
 * The site has one scroll listener left (`hooks/useScrollProgress.ts`, home
 * page only) and motion-contract §7 is the reason it has only one. The rail
 * does not add a second. Each chapter declares `data-rail-mark="<index>"` on
 * its own element, and one IntersectionObserver whose root is collapsed to a
 * thin band across the middle of the window (`rootMargin: -48% 0`) answers
 * "which chapter is the reader in" as plain intersection, off the main thread,
 * and only when it changes. The rail is derived from the document rather
 * than from a parallel list of scroll offsets that would be wrong the first
 * time a paragraph wrapped differently.
 *
 * Marks are indices into `chapters`, and -1 is the opening: the opening
 * shows the first year and lights nothing, because nothing has been walked
 * yet.
 *
 * IT TAKES THE INK OF THE GROUND BEHIND IT
 * ----------------------------------------
 * A translucent sheet of paper over the peak's dark ground composites to a
 * mid grey with no contrast against either end — the same argument
 * `nav/useDarkChrome.ts` makes for the bar. So the rail inverts while the
 * peak is in the band. It is told which chapter is dark by the chapter list,
 * not by sniffing the element's class, so the rail cannot disagree with the
 * page about which act is the dark one.
 *
 * WHY aria-hidden
 * ---------------
 * Everything the rail says, the page says in text: each chapter's kicker
 * prints its years, and the order of the document is the order of the walk.
 * A second, position-dependent announcement of the same year would be noise
 * a screen-reader user cannot turn down. Below 62rem it is not drawn at all —
 * a phone has no spare column for it, and the kickers carry the years there.
 */

export type RailChapter = { id: string; railYear: number; peak: boolean };

type YearRailProps = {
  chapters: readonly RailChapter[];
  /** The page root the marks are looked for in. */
  root: RefObject<HTMLElement | null>;
  /** The year shown over the opening, before any chapter is reached. */
  firstYear: number;
};

export default function YearRail({ chapters, root, firstYear }: YearRailProps) {
  /* -1 is the opening. `walked` only ever grows; see the head of the file. */
  const [here, setHere] = useState(-1);
  const [walked, setWalked] = useState(-1);

  useEffect(() => {
    const el = root.current;
    /* Same guard as Rise and useEnteredOnce: an engine without the observer
       gets a still rail showing the first year, never a thrown commit. */
    if (!el || typeof IntersectionObserver !== "function") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const at = Number((e.target as HTMLElement).dataset.railMark);
          if (Number.isNaN(at)) continue;
          setHere(at);
          setWalked((w) => Math.max(w, at));
        }
      },
      /* A band 4% of the window tall through its middle. Thin enough that
         two chapters are almost never in it at once, and when they are for a
         frame the later entry in the batch wins, which is the one the reader
         is scrolling towards. */
      { rootMargin: "-48% 0px -48% 0px", threshold: 0 }
    );
    for (const mark of el.querySelectorAll("[data-rail-mark]")) observer.observe(mark);
    return () => observer.disconnect();
  }, [root, chapters]);

  const current = here >= 0 ? chapters[here] : undefined;
  const year = current?.railYear ?? firstYear;

  return (
    <div className={styles.rail} data-dark={current?.peak ? "" : undefined} aria-hidden="true">
      <span className={styles.railCap}>The years</span>
      <span className={styles.railYear} data-rail-year="">
        {year}
      </span>
      <span className={styles.railMarks}>
        {chapters.map((c, i) => (
          <i
            key={c.id}
            className={styles.railDot}
            data-passed={i <= walked ? "" : undefined}
            data-here={i === here ? "" : undefined}
          />
        ))}
      </span>
    </div>
  );
}
