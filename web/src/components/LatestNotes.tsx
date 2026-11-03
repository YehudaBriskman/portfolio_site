import { useCallback, useMemo, type CSSProperties, type FocusEvent, type MouseEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import LabelSkeleton from "@/components/gallery/LabelSkeleton";
import ObjectLabel from "@/components/gallery/ObjectLabel";
import SkeletonGate from "@/components/gallery/SkeletonGate";
import type { LabelField } from "@/components/gallery/objectLabel";
import InkRule from "@/components/motion/InkRule";
import AuroraStrand from "@/components/motion/AuroraStrand";
import Shot from "@/components/projects/Shot";
import type { Project } from "@/data/projects";
import { useContent } from "@/content/store";
import { blog, type PostSummary } from "@/services/blog";
import dark from "@/components/notes/DarkCard.module.css";
import styles from "@/components/LatestNotes.module.css";

/*
 * The notes, as a shelf the reader's scroll carries past (#159).
 *
 * What changed, and what it copies
 * --------------------------------
 * The shelf used to drift sideways while the page moved on underneath it: the
 * section scrolled away at full speed and the pan was a garnish on top. The
 * owner's note was that it "still moves the whole page". Now the stage pins,
 * and while it is held the reader's scroll walks the shelf past inside it,
 * then releases. Scrolling up walks it back, exactly — scroll is the clock,
 * as in the contribution city (#111).
 *
 * It is not a new mechanism. It is the work run's (`projects/ProjectRun.tsx`,
 * #57): a static stage that owns a named view timeline, a sticky frame one
 * window tall inside it, a transform keyed to the stage's `contain` range,
 * and the document as the one real scroll container. Wheel, touch, the
 * scrollbar, Space, Page Down, Home and End all move the page, and the page
 * is the clock, so every one of them drives the shelf without a line of
 * script. The frame clips; it does not scroll, so there is no second
 * scroller to fight the first.
 *
 * What differs from the run is only the shape of the travel: a flat row,
 * every card at the same height, sliding by one card-width per step of
 * scroll — the shelf's `pan`, not the run's curve. The ledger
 * (docs/motion-contract.md §2) argues why a held pan is still a pan.
 *
 * The one piece of script is the run's keyboard answer, unchanged in kind.
 * A card's place on screen is a transform, so Tab reaching a card still off
 * to the right has nothing the browser can scroll sideways to. On focus the
 * page is scrolled to the moment that card stands in the middle of the
 * frame; the moment is a zero-height marker the stylesheet places in the
 * runway, so the formula lives once, in CSS. With motion off the markers are
 * inert and the browser's own focus scrolling does the job on the plain list.
 * And a way past it: a skip link ahead of the stage, visible on focus, that
 * moves focus to just after it. No trap.
 *
 * The ground, and the cards on it
 * -------------------------------
 * The section is paper, the page's own ground, as #171 left it: the notes are
 * the page talking about the work, and the dark-act ceiling in
 * `ground/DarkAct.tsx` is untouched. What is dark is each CARD (#179, as the
 * owner corrected it after #182 darkened the whole section): a warm dark
 * card with a border, standing on paper. `.on-panel` and the card's own
 * stops (`notes/DarkCard.module.css`) are on the card element itself, so
 * every role inside it re-inks, and nothing outside it does. No
 * `data-chrome` anywhere: a card is not a ground the nav passes over.
 *
 * The cards
 * ---------
 * One height, every one; covers where a note has one. On hover and keyboard
 * focus a card grows into the room its slot already reserved and its
 * description slides in; on touch, with reduced motion and with Pause the
 * description is simply there. The mechanism is in the stylesheet at `.card`.
 *
 * Deliberately not the ARIA carousel
 * ----------------------------------
 * A tablist of dots with one visible panel would hide five of six notes from a
 * screen reader in exchange for an effect a screen reader never sees. What this
 * is, in markup and in the accessibility tree, is a list of links. Every card
 * is present, laid out, and in the tab order at all times, in document order.
 * That is also what lets all three switch-offs land on a plain vertical list
 * without anything being lost.
 */

/*
 * Six, as before. A shelf needs enough on it to be worth walking along, and
 * six steps of 18svh is a 108svh hold — under the year's 120svh and well
 * under the run's 220svh, which is the order the peak rule asks for.
 */
const SHOWN = 6;

/*
 * The most a description may run to before it is cut: a shade under the two
 * lines the card opens by, at the label's fact step and the phone's card
 * width. The stylesheet clamps at two lines as well; this cut is the one that
 * lands on a word boundary.
 */
const FACT_MAX = 84;

/* A card is at most 23rem on the shelf and 40rem in the plain list; on a
   phone it is three quarters of the window either way. */
const COVER_SIZES = "(min-width: 700px) 640px, 92vw";

/**
 * Which project a note belongs to, by slug. Built from the project table the
 * page already holds (the content store's, #163) rather than fetched: this is
 * the home page, and a second request to label three
 * fields would be a second thing that can fail.
 */
const titlesOf = (projects: readonly Project[]) => new Map(projects.map((p) => [p.slug, p.title]));

/** The date, short enough to survive being cropped. */
function monthAndYear(iso: string | null): string {
  if (!iso) return "";
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return "";
  return when.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

/**
 * One sentence, and never two. The subtitle is the author's and is used as it
 * stands; the machine-cut excerpt speaks only when there is no subtitle, and
 * then only as far as its first full stop.
 */
function factLine(post: PostSummary): string {
  const written = post.subtitle?.trim();
  if (written) return written;

  const text = post.excerpt.trim();
  const stop = text.search(/[.!?](\s|$)/);
  const sentence = stop === -1 ? text : text.slice(0, stop + 1);
  if (sentence.length <= FACT_MAX) return sentence;

  const space = sentence.lastIndexOf(" ", FACT_MAX);
  return `${sentence.slice(0, space > 0 ? space : FACT_MAX).trimEnd()}…`;
}

/**
 * Where it lives, how long it takes, when it landed — most identifying first,
 * because on a travelling shelf the first field is the one still on screen
 * when the rest of the card is not. An empty field is omitted, not printed.
 */
function noteFields(post: PostSummary, projectTitles: Map<string, string>): LabelField[] {
  const fields: LabelField[] = [
    { kind: "where", value: projectTitles.get(post.collection) ?? "Notes" },
  ];
  if (post.readingMinutes > 0) {
    fields.push({ kind: "reading", value: `${post.readingMinutes} min` });
  }
  const when = monthAndYear(post.publishedAt);
  if (when) fields.push({ kind: "when", value: when });
  return fields;
}

/** Is the shelf actually moving? One read covers all three off-switches. */
function running(track: Element): boolean {
  return getComputedStyle(track).animationName !== "none";
}

/* Where the skip link lands. */
const ONWARD = "notes-shelf-onward";

export default function LatestNotes() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["notes", "latest"],
    queryFn: () => blog.posts(),
    staleTime: 5 * 60 * 1000,
    /* One retry, not three: this is a shelf on a page the reader is scrolling
       past, and the honest sentence is better arriving fast. */
    retry: 1,
  });

  const posts = (data ?? []).slice(0, SHOWN);
  const { projects } = useContent();
  const projectTitles = useMemo(() => titlesOf(projects), [projects]);

  /* The run's keyboard answer: scroll the document — the real scroll
     container — to the focused card's marker. `instant`, because focus has
     already moved and a smooth scroll would be the page moving on its own. */
  const onFocus = useCallback((e: FocusEvent<HTMLUListElement>) => {
    const slot = (e.target as HTMLElement).closest<HTMLElement>("[data-shelf-i]");
    if (!slot || !running(e.currentTarget)) return;
    const stage = slot.closest<HTMLElement>("[data-shelf-stage]");
    const marker = stage?.querySelector<HTMLElement>(
      `[data-shelf-mark="${slot.dataset.shelfI}"]`
    );
    marker?.scrollIntoView({ behavior: "instant", block: "start" });
  }, []);

  const skip = useCallback((e: MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById(e.currentTarget.hash.slice(1));
    if (!target) return;
    e.preventDefault();
    target.focus({ preventScroll: false });
  }, []);

  return (
    <section
      id="notes"
      className="section-y relative"
    >
      <div className="wrap section-head">
        <InkRule className="section-head-rule" />
        <h2 className="display text-section leading-[0.9]">Notes</h2>
        <InkRule className="section-head-rule" />
        <p className="eyebrow section-head-note">Decisions and what they cost</p>
      </div>

      {/*
       * Three states, and the section survives all of them: the heading, the
       * invitation and the way through are static markup, and the shelf is
       * the only part that depends on the network.
       */}
      {isPending && (
        /*
         * The shelf with the labels not written yet: the same stage, the same
         * hold, the same six slots, so nothing moves under the reader when the
         * request lands. `SkeletonGate` carries the `aria-hidden` and the
         * 180ms before any of it is painted. No markers, no focus handler and
         * no skip link — there is nothing in it to reach.
         */
        <SkeletonGate className={styles.stage}>
          <div
            className={styles.stageInner}
            style={{ "--shelf-n": SHOWN } as CSSProperties}
          >
            <div className={styles.frame}>
              <ul className={styles.track}>
                {Array.from({ length: SHOWN }, (_, i) => (
                  <li key={i} className={styles.slot}>
                    <div className={`on-panel ${dark.dark} ${styles.card}`}>
                      <div className={`${styles.plinth} ${styles.ghost}`}>
                        <LabelSkeleton
                          scale="inline"
                          nameLines={2}
                          factLines={2}
                          fields={3}
                          className={styles.ghostLabel}
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </SkeletonGate>
      )}

      {!isPending && posts.length > 0 && (
        <div className={styles.act}>
          <div className="wrap">
            <a
              href={`#${ONWARD}`}
              onClick={skip}
              className={`${styles.skip} sr-only focus:not-sr-only`}
            >
              Skip past the notes
            </a>
          </div>

          {/*
            The static stage owns the clock: as tall as the frame plus the
            runway, still travelling while the frame inside it is held. Its
            named view timeline is what the track reads (motion contract §1).
          */}
          <div className={styles.stage} data-shelf-stage="">
            <div
              className={styles.stageInner}
              style={{ "--shelf-n": posts.length } as CSSProperties}
            >
              {posts.map((post, i) => (
                /* Each card's moment in the runway, placed by the stylesheet.
                   `aria-hidden` and outside the list, so the list announces
                   exactly its notes. */
                <span
                  key={`mark-${post.slug}`}
                  data-shelf-mark={i}
                  className={styles.mark}
                  style={{ "--shelf-i": i } as CSSProperties}
                  aria-hidden="true"
                />
              ))}

              <div className={styles.frame}>
                {/* The aurora behind the cards, as the run has (owner,
                    2026-11-03): the line the row travels on, through every
                    card's middle, in from the left on the shelf's own clock
                    and whole just after the frame pins. */}
                <div className={styles.aurora} data-notes-aurora="">
                  <AuroraStrand from="left" timeline="--notes-shelf" range="entry 40% contain 6%" />
                </div>
                <ul className={styles.track} aria-label="Latest notes" onFocus={onFocus}>
                  {posts.map((post, i) => {
                    const fact = factLine(post);
                    return (
                    <li key={post.slug} data-shelf-i={i} className={styles.slot}>
                      <Link
                        to={`/blog/${post.slug}`}
                        className={`on-panel ${dark.dark} ${styles.card}`}
                        data-cover={post.coverImage ? "" : undefined}
                        /* Only a card with something to say grows to say it. */
                        data-desc={fact ? "" : undefined}
                      >
                        {post.coverImage && (
                          /* Decorative: the label beside it names the note,
                             and an alt here would be read before the title. */
                          <div className={styles.cover}>
                            <Shot src={post.coverImage} alt="" sizes={COVER_SIZES} />
                          </div>
                        )}
                        <div className={styles.plinth}>
                          {/* `inline`: a label on a travelling shelf is half
                              visible for longer than it is whole, and at this
                              step its first 145px still name the note. */}
                          <ObjectLabel
                            scale="inline"
                            nameAs="h3"
                            name={post.title}
                            fact={fact}
                            fields={noteFields(post, projectTitles)}
                            className={styles.label}
                          />
                          <span className={styles.onward} aria-hidden="true">
                            &rarr;
                          </span>
                        </div>
                      </Link>
                    </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>

          {/* Focusable by script only, so the next Tab goes on to whatever
              follows the shelf. */}
          <span id={ONWARD} tabIndex={-1} className={styles.onwardMark} />
        </div>
      )}

      {!isPending && posts.length === 0 && (
        <div className="wrap">
          {/* Announced, not just rendered: the shelf goes loading → failed
              without the heading changing. `status`, not `alert` — nothing
              here is an error the reader has to act on. */}
          <p
            role="status"
            className="mt-12 max-w-xl text-lg leading-relaxed text-clay"
          >
            {isError
              ? "The notes aren't loading just now. They're still there — the index has all of them."
              : "Nothing published yet. The index is where they'll appear."}
          </p>
        </div>
      )}

      <div className="wrap">
        <Link to="/blog" className="btn btn-quiet mt-section-sm">
          All notes <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
