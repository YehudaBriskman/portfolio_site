import { Fragment } from "react";
import { Link } from "react-router-dom";
import Figure from "@/components/Figure";
import Shot from "@/components/projects/Shot";
import Plate from "@/components/projects/Plate";
import Action from "@/components/ui/Action";
import PaperCard from "@/components/cards/PaperCard";
import { cardType } from "@/components/cards/cardType";
import { relativeTime } from "@/services/blog";
import type { ProjectEntry } from "@/hooks/useProjects";
import styles from "@/components/carousel/CarouselCard.module.css";

/*
 * A project as a card on a shelf, rather than as a page about the project.
 *
 * What this stopped printing, and where each thing went
 * -----------------------------------------------------
 * The block this replaces carried eighteen distinct pieces of content per
 * project. Five survive. The test applied to each was not "is it true" —
 * every one of them is — but "does a reader need it before they decide
 * whether to click", and almost nothing does.
 *
 *   The screenshot stays. It is the only part of a card that distinguishes
 *   one project from another at a glance, and the pictures are already
 *   built, already sized and already downloaded.
 *
 *   The name stays, and the tagline, because between them they are the
 *   whole claim: "WindoM / Every new tab becomes a dashboard" is a project
 *   someone can decide about.
 *
 *   Two or three small facts stay — see `facts()` below.
 *
 *   One action stays, and it points inward. The old block offered three:
 *   the detail page, the live product and the repository. Two of those sent
 *   the reader off the site from the first thing they saw, which is the
 *   documented reason the project pages never got any traffic. Both are on
 *   the detail page, one rank down, where they already were.
 *
 * The description goes: it is three lines of prose printed verbatim on the
 * detail page, so on a card it is a spoiler that costs the click. The three
 * highlights go: they are the argument, and the argument deserves the page
 * that can make it rather than three bullets glimpsed from a moving shelf.
 * The eight technology chips go: a chip row is the densest object on the
 * card and the first chip says as much as all eight — a reader who wants
 * the stack wants the whole stack, and that is a list, on a page.
 *
 * The year and the status are not cut, only moved: both are facts *about*
 * the picture, so they are set in the picture's caption, which is where
 * every other figure on this site puts the same two things.
 *
 * The card itself is a `PaperCard`, not a shape drawn again here. The
 * surface, the 32px corner, the edge, the lift on hover and the resting
 * wash all come from the one component the rest of the page is built out
 * of, and the three type roles come from `cardType`, where the contrast of
 * each against the washes has already been measured. A carousel is a way of
 * arranging cards; it is not a reason to invent a second kind of card.
 */

/*
 * The small data.
 *
 * Three different kinds of fact, deliberately, because three of the same
 * kind is a list and a list is what we just removed: what the project is
 * now, what it is built out of, and one honest signal that it is alive.
 *
 * The third is the only one that can be absent, and absent is the normal
 * case — a seed-backed project has no repository stats at all, and inventing
 * one would undo the only thing that makes those numbers worth printing. So
 * a card shows three facts when the repository has something to say and two
 * when it does not, which is also why the brief asked for "two or three".
 */
function facts(entry: ProjectEntry): string[] {
  const out = [entry.state];
  if (entry.tech[0]) out.push(entry.tech[0]);

  const s = entry.collection.stats;
  if (typeof s?.stars === "number" && s.stars > 0) {
    out.push(s.stars === 1 ? "1 star" : `${s.stars} stars`);
  } else if (s?.pushedAt) {
    const when = relativeTime(s.pushedAt);
    if (when) out.push(`pushed ${when}`);
  }

  return out;
}

/**
 * What level the card's own title is set at.
 *
 * A card title is a subhead under whatever heading introduces the shelf,
 * and that differs by page: on the home page the shelf sits under `Work`,
 * an h2, so the cards are h3; on /projects the only heading above them is
 * the page title, so an h3 would skip a level and leave a reader using
 * headings to navigate wondering what they had missed. The page is the only
 * thing that knows, so the page says.
 */
export type CardHeading = "h2" | "h3";

export type CarouselCardProps = {
  entry: ProjectEntry;
  heading: CardHeading;
  /** The plate number printed in the caption. Numbering runs across the page,
   *  not across this component, so the carousel owns it. */
  plate: number;
  /** The first card on the home page is above the fold and is the LCP image. */
  eager?: boolean;
};

export default function CarouselCard({ entry, heading, plate, eager = false }: CarouselCardProps) {
  const Heading = heading;
  const { collection: c } = entry;
  const to = `/projects/${c.slug}`;
  const small = facts(entry);

  return (
    <PaperCard as="article" flush className={styles.card}>
      {/*
        The picture is a link and the title is not.

        One target per card, announced once. A reader using a screen reader
        hears the caption, the name, the line and the facts as content and
        then exactly one link out of the card; a reader using a mouse gets
        the whole screenshot as a hit area as well, because the anchor around
        it is hidden from the accessibility tree and taken out of the tab
        order rather than being a second announcement of the same
        destination. This is the arrangement the home page already used.
      */}
      <Figure
        index={plate}
        caption={c.title}
        note={entry.year ?? undefined}
      >
        <Link to={to} tabIndex={-1} aria-hidden="true" className="block">
          {c.coverImage ? (
            <Shot
              src={c.coverImage}
              alt={`${c.title} screenshot`}
              className="aspect-[16/10]"
              /* The slot is one card wide, never the viewport: on a desktop
                 shelf three of these sit in 1072px, so asking for 100vw here
                 is what makes a phone download the 1600px file. */
              sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 80vw"
              eager={eager}
            />
          ) : (
            /*
              Four of the stack, and no tagline.

              `Plate` lays its stack out in two columns and lets the box grow
              to fit; a card slot is a fixed 16:10 and Bothy's eight entries
              are four rows plus a caption, which overflowed the frame and
              was sheared off mid-row. Four is two rows, which fits at every
              width this card is ever drawn at. The tagline is not passed
              because it is printed six millimetres below the picture on the
              card itself, and a plate that repeats the line under it is the
              same mistake the eight chips were.
            */
            <Plate className="aspect-[16/10]" title={c.title} tech={entry.tech.slice(0, 4)} />
          )}
        </Link>
      </Figure>

      <div className={styles.body}>
        <Heading className={cardType.title}>{c.title}</Heading>
        <p className={`${cardType.body} ${styles.line}`}>{c.tagline}</p>

        <p className={`${cardType.meta} ${styles.facts}`}>
          {small.map((f, i) => (
            <Fragment key={f}>
              {i > 0 && (
                <span aria-hidden="true" className={styles.factSep}>
                  ·
                </span>
              )}
              <span className={i === 0 ? styles.factLead : undefined}>{f}</span>
            </Fragment>
          ))}
        </p>

        <div className={styles.foot}>
          {/*
            Six cards each offering a link called "The detail" is six
            identical entries in a screen reader's link list, so the
            accessible name carries the project and the visible label stays
            the short one. `aria-label` wins over the text for an element
            with a role that allows naming from author, which is what makes
            the two able to differ at all.
          */}
          <Action tone="outline" glyph="onward" to={to} aria-label={`${c.title} — the detail`}>
            The detail
          </Action>
        </div>
      </div>
    </PaperCard>
  );
}
