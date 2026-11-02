import { useMemo, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import PageShell from "@/components/PageShell";
import Written from "@/components/motion/Written";
import styles from "@/components/story/Story.module.css";
import { buildStory, type Beat } from "@/data/story";

/*
 * /story — the work along the year, as a timeline (#46, #158).
 *
 * Many short beats, each a year or a moment, a line or two and a picture,
 * with real space between them. The beats are built by `data/story.ts` from
 * the project table and cannot drift from it; the reasoning is there.
 *
 * MOTION: SCROLL IS THE CLOCK
 * ---------------------------
 * Everything on this page that moves is scrubbed by scroll position and runs
 * backwards, exactly, when the reader scrolls up. Nothing fires once, nothing
 * runs on a timer. Four devices, all in `Story.module.css` except the pen:
 *
 *   | device   | what it is                                                       |
 *   |----------|------------------------------------------------------------------|
 *   | spine    | the timeline's rule, drawn down to the middle of the window      |
 *   | knot     | a beat's mark on the spine, filled as the spine's tip passes it  |
 *   | plate    | a beat's picture card, uncovered as it rises into the window     |
 *   | pen      | a beat's lines, written word after word (`motion/Written`)       |
 *
 * All three off-switches — reduced motion, the site's Pause, and a browser
 * without scroll-driven animation — land on the finished state: the spine
 * drawn, every knot filled, every plate uncovered, every word at ink.
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

function BeatItem({ beat }: { beat: Beat }) {
  const headId = `${beat.id}-title`;
  return (
    <li id={beat.id} className={styles.beat} data-kind={beat.kind}>
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

export default function Story() {
  const story = useMemo(() => buildStory(), []);

  return (
    <PageShell>
      <div className={styles.story}>
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
          <ol className={styles.timeline} aria-label="Timeline">
            {story.beats.map((b) => (
              <BeatItem key={b.id} beat={b} />
            ))}
          </ol>
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
