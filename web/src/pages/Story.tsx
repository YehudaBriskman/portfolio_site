import { Fragment, useMemo, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import PageShell from "@/components/PageShell";
import Written from "@/components/motion/Written";
import LivingLine from "@/components/motion/LivingLine";
import styles from "@/components/story/Story.module.css";
import { lineAttr } from "@/components/motion/lineMoves";
import { STORY_LINE, buildStory, type Beat, type Interlude } from "@/data/story";

/*
 * /story — the work along the year, as a timeline (#46, #158, #176).
 *
 * Many short beats, each a year or a moment, a line or two and a picture,
 * with real space between them. The beats are built by `data/story.ts` from
 * the project table and cannot drift from it; the reasoning is there.
 *
 * THE LINE
 * --------
 * One line runs the length of the timeline (`motion/LivingLine`), grown
 * from a dot in the middle of the page above the first beat. It runs
 * down the lane on the side of each beat's picture — and the pictures
 * alternate sides — so it turns across the page between beats, in circular arcs. Three times
 * it breaks out of the timeline into an interlude: it draws a loop in the
 * middle of the page round a few words, and carries on down. The words are
 * real text, written by the pen like every other line here.
 *
 * MOTION: SCROLL IS THE CLOCK
 * ---------------------------
 * Everything on this page that moves is scrubbed by scroll position and runs
 * backwards, exactly, when the reader scrolls up. Nothing fires once, nothing
 * runs on a timer.
 *
 *   | device   | what it is                                                        |
 *   |----------|-------------------------------------------------------------------|
 *   | line     | the one line, its tip on the middle of the window (`LivingLine`) |
 *   | plate    | a beat's picture card, uncovered as it rises into the window      |
 *   | pen      | a beat's lines and a loop's words, word after word (`Written`)    |
 *
 * All three off-switches — reduced motion, the site's Pause, and a browser
 * without scroll-driven animation — land on the finished state: the line
 * drawn, every plate uncovered, every word at ink.
 */

function Plate({ beat }: { beat: Beat }) {
  const shape = { aspectRatio: beat.ratio } as CSSProperties;
  if (beat.image) {
    return (
      <figure className={styles.plate} style={shape}>
        <img src={beat.image.src} alt={beat.image.alt} className={styles.plateImg} loading="lazy" decoding="async" />
      </figure>
    );
  }
  /* No picture yet: the card on the skeleton ground, in the picture's own
     shape, so the page does not move when one arrives. Nothing in it is
     content, so it is out of the accessibility tree. */
  return <div className={`${styles.plate} ${styles.plateEmpty}`} style={shape} aria-hidden="true" />;
}

function BeatItem({ beat, side }: { beat: Beat; side: "start" | "end" }) {
  const headId = `${beat.id}-title`;
  return (
    <li id={beat.id} className={styles.beat} data-kind={beat.kind} data-layout={beat.layout} data-side={side} data-line={lineAttr(beat.line ?? STORY_LINE.beat(side))}>
      <div className={styles.beatText}>
        <p className={`${styles.when} text-field`}>{beat.when}</p>
        <h2 id={headId} className={`display ${styles.title}`}>
          {beat.href ? (
            <Link to={beat.href} className={styles.titleLink}>
              {beat.title}
            </Link>
          ) : (
            beat.title
          )}
        </h2>
        <Written className={styles.lines}>{beat.lines.join(" ")}</Written>
      </div>
      <Plate beat={beat} />
    </li>
  );
}

/*
 * An interlude: the loop's box, square, the words centred in it. The line
 * is drawn round the box with its move's `pad` of clearance, so the words sit
 * inside the circle's inscribed square with room to spare.
 */
function InterludeItem({ interlude }: { interlude: Interlude }) {
  return (
    <li id={interlude.id} className={styles.interlude} data-kind="interlude">
      <div className={styles.loop} data-line={lineAttr(interlude.line ?? STORY_LINE.interlude)}>
        <Written className={styles.loopWords} lang="en">
          {interlude.words.en}
        </Written>
        <Written className={styles.loopWords} lang="he" dir="rtl">
          {interlude.words.he}
        </Written>
      </div>
    </li>
  );
}

export default function Story() {
  const story = useMemo(() => buildStory(), []);

  return (
    <PageShell>
      <div className={styles.story} data-page="story">
        <header className={`wrap ${styles.open}`}>
          <p className="eyebrow">The story</p>
          <h1 className={`display ${styles.openTitle}`}>The long way round</h1>
          <p className={`text-field ${styles.sig}`}>
            <span>
              {story.firstYear}–{story.lastYear}
            </span>
          </p>
        </header>

        <div className="wrap">
          <LivingLine className={styles.lined}>
            {/* The seed (#191): a dot in the middle of the page, before the
                first beat, that the line grows out of. Decoration only. */}
            <span className={styles.seed} data-line={lineAttr(STORY_LINE.origin)} aria-hidden="true" />
            <ol className={styles.timeline} aria-label="Timeline">
              {story.beats.map((b, i) => (
                <Fragment key={b.id}>
                  <BeatItem beat={b} side={i % 2 === 0 ? "start" : "end"} />
                  {story.interludes
                    .filter((x) => x.after === b.id)
                    .map((x) => (
                      <InterludeItem key={x.id} interlude={x} />
                    ))}
                </Fragment>
              ))}
            </ol>
          </LivingLine>
        </div>

        <section aria-labelledby="close-title" className={`wrap ${styles.close}`}>
          <h2 id="close-title" className={`display ${styles.closeTitle}`}>
            So far
          </h2>
          <dl className={styles.figures}>
            {story.figures.map((f) => (
              <div key={f.caption} className={styles.figure}>
                <dt className={`${styles.figureCaption} text-field`}>{f.caption}</dt>
                <dd className={styles.figureValue}>{f.value}</dd>
              </div>
            ))}
          </dl>
          <p className={styles.onward}>
            <Link to="/projects" className={styles.onwardLink}>
              All the work, without the years <span aria-hidden="true">→</span>
            </Link>
          </p>
        </section>
      </div>
    </PageShell>
  );
}
