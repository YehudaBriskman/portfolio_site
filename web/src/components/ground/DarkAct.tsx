import type { ReactNode } from "react";
import styles from "@/components/ground/DarkAct.module.css";

/*
 * A dark act: the ground, the two seams and the drift, as one wrapper.
 *
 * ── there are two, and the pair is the argument ───────────────────────────
 *
 * The ceiling is two dark acts on this page and a third is a different page.
 * Which two is settled by the rule `index.css` already states for every
 * ground on the site — a ground changes where the SUBJECT changes — and under
 * that rule the pair picks itself:
 *
 *   Work      the work that was made
 *   The Year  the making of it
 *
 * Those are the only two sections on the home page whose subject is the work
 * itself. Approach is how the work gets thought about, the shelf is what gets
 * written, the spec plate is facts about the person and the close is an ask.
 * All four are the page talking ABOUT the work, and the page talks on paper.
 * So the dark ground is not a highlight applied to the two best sections; it
 * is what the page looks like when the work is the thing on screen.
 *
 * The year was the obvious candidate and the obvious reason is the weaker one.
 * "A city, at night" is a nice sentence and it is not an argument — it would
 * justify the dark ground on any section that happened to have a 3D act in
 * it. What makes it right is that the city is a year of real labour, which is
 * the one claim on the page that is not the owner's to write.
 *
 * Approach between them is not a gap; it is the separation, and it was already
 * argued for on exactly these grounds. `Index.tsx` puts the wall text between
 * the pile and the year because both of those acts carry real depth and
 * neither should read as the other's warm-up — written about motion, true
 * verbatim about ground. Two dark acts with nothing between them are one long
 * dark act with a seam in it.
 *
 * ── the footer is dark too, and it is not a third act (#160) ──────────────
 *
 * Since #160 the site footer stands on `--panel`. That reads like a breach of
 * the ceiling above, and the case that it is not has to be made here, beside
 * the ceiling, or the next reader will either count it and cut it or not
 * count it and take it as licence for a fourth.
 *
 * What the ceiling counts is SECTIONS — beats of the page's argument, each
 * with a subject. The subject rule picks which two go dark, and the ceiling
 * exists because a third dark section dilutes "dark means the work is the
 * thing on screen" until it means nothing. The footer has no subject in that
 * sense. It is on every route, not only this one; it is the same on a post
 * as on the home page; and it says nothing about the work — it is
 * navigation, a colophon and a copyright line. It is chrome, like the nav
 * island, which has gone dark over these acts since `nav/useDarkChrome.ts`
 * taught it to, without anybody counting the island as an act either.
 *
 * Four things keep that claim honest, and if any of them stops being true the
 * footer IS a third act and the ceiling applies to it:
 *
 *   1. It does not use this component. No arc, no seams, no drift, no crest.
 *      Those are what make an act read as a gap between two sheets with light
 *      behind it; the footer has a straight edge and no motion at all, so it
 *      reads as the edge of the page, which is what it is.
 *   2. It has no section head and nothing that would put it in the page's
 *      sequence of named things.
 *   3. It is the last thing on every page, so it can never sit between two
 *      sections and break the paper run the way a mid-page act does. On the
 *      home page Notes, Specs and Contact stand between the year and the
 *      footer — three paper sections, more separation than Approach gives
 *      the two acts — and the close still closes on paper, where the hero
 *      opened.
 *   4. It carries nothing a reader came for. A ground that marks the work
 *      would be diluted by a third section about the work; a ground that
 *      marks "the page has ended" is a different signal on the same paint.
 *
 * The cost, said plainly: dark now means two things on the home page, "the
 * work" mid-page and "the end" at the foot. They are told apart by place and
 * by shape — the acts are arched plates in the middle of the scroll, the
 * footer is a flat band at the bottom of every route — and not by colour.
 *
 * ── /projects has a dark panel, and it is not an act either (#175) ────────
 *
 * The catalogue's stats panel (`projects/StatsPanel.tsx`) stands on
 * `--panel` as well. The ceiling counts the home page's acts, and this is a
 * different page; but the same test applies, and it passes the same way the
 * footer does. It does not use this component (no arc, seams or drift), it
 * has no section head, and it is not a beat with a subject: it is an
 * instrument, a figure inside the catalogue's own paper section with paper
 * on every side of it. Dark there means "this is a readout", the way a dark
 * screen in a gallery is a readout and not a room. If it ever goes edge to
 * edge or picks up a crest, it has become an act and this argument is void.
 *
 * ── what a dark act needs, and the half of it that fails silently ─────────
 *
 * `.on-panel` AND `data-chrome="dark"`, and the two are not interchangeable.
 * The first re-points `--canvas`, `--canvas-2`, `--canvas-3`, `--ink`,
 * `--ink-soft`, `--rule`, `--rule-firm`, `--signal` and `--shade`, and — the
 * part that actually matters — restates `color`, because `color` inherits as a
 * computed value and redefining `--ink` on a subtree does not re-ink text that
 * already resolved on `<body>`. The second is the hook `nav/useDarkChrome.ts`
 * observes to switch the nav island's material while the act passes under it.
 *
 * Neither of them is applied here, and that is deliberate rather than an
 * omission: both belong on the `<section>` so that the ground genuinely drops
 * out from under the content edge to edge, which `Work.tsx` explains at
 * length. This wrapper paints the plate; the section inside it carries the
 * palette. `index.css` hands `.ground > .on-panel` a transparent background
 * for exactly that split.
 *
 * ── no observer, since #162 ──────────────────────────────────────────────
 *
 * The drift used to be two clock loops (71s and 97s) and this component kept
 * an `IntersectionObserver` to cancel them while the act was off screen. The
 * owner's rule — every animation controllable with simple scrolling,
 * reversing on the way up — moved the drift onto each seam's own view
 * timeline, and a scroll-driven animation does no work while its subject is
 * out of range. So the observer, its state and its attribute went: the
 * component is markup and nothing else.
 */

type DarkActProps = {
  children: ReactNode;
};

export default function DarkAct({ children }: DarkActProps) {
  return (
    <div
      /*
       * `layer-section` and `ground` are the page's own plate classes and they
       * stay — the breathing room and the panel fill are not this component's
       * inventions. `styles.act` adds the arc, the hairline and the seams, and
       * it is unlayered CSS Modules output, so it wins over the plain radius
       * `@layer components` sets for a plate.
       */
      className={`layer-section ground ${styles.act}`}
      data-ground="panel"
    >
      {/* Both seams are in the DOM under every switch. What the switches take
          away is the movement, never the boundary — the arcs and their
          hairlines are drawn by `.act` and by `.crest` and are not animated at
          all, so a reader who has asked for no motion still gets the edge. */}
      <div className={styles.seam} data-edge="start" aria-hidden="true" />
      {children}
      <div className={styles.seam} data-edge="end" aria-hidden="true" />
      {/* Last, so it paints over the end seam. See `.crest` in the
          stylesheet: the light leaking around a near object is the point. */}
      <div className={styles.crest} aria-hidden="true" />
    </div>
  );
}
