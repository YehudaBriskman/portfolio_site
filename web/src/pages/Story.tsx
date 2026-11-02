import { useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import PageShell from "@/components/PageShell";
import DarkAct from "@/components/ground/DarkAct";
import Flow from "@/components/motion/Flow";
import InkRule from "@/components/motion/InkRule";
import InkWipe from "@/components/motion/InkWipe";
import Rise from "@/components/motion/Rise";
import Written from "@/components/motion/Written";
import ObjectLabel from "@/components/gallery/ObjectLabel";
import Shot from "@/components/projects/Shot";
import YearRail from "@/components/story/YearRail";
import styles from "@/components/story/Story.module.css";
import { buildStory, type Chapter } from "@/data/story";
import type { Project } from "@/data/projects";
import { useEnteredOnce } from "@/hooks/useEnteredOnce";

/*
 * /story — the work as a chaptered editorial, told along the year (#46).
 *
 * The collection (`/`, `/projects`) is atemporal by design: it shows what
 * exists. This route is the other axis — how it got here — and is the half a
 * list of objects throws away. It is not a résumé page and not a PDF: there
 * is no employer list, no date-range table, no download. Chapters, a rail
 * that counts the years, and the projects themselves as evidence inside the
 * argument rather than as its subject. The arc is built from the project
 * table by `data/story.ts` and cannot drift from it; the long reasoning for
 * what is derived and what is written is there.
 *
 * THE DEVICE LEDGER FOR THIS PAGE
 * ===============================
 * `docs/motion-contract.md` §2 is the ledger for the home page, and its rule
 * is a page-level rule: four or more device families, never the same one
 * twice running, one peak. This page keeps its own, here, because it is the
 * one file that can see every beat at once.
 *
 *   | # | beat              | family   | the one reason it exists                                   |
 *   |---|-------------------|----------|------------------------------------------------------------|
 *   | — | the rail          | tally    | the walk is recorded, and stays recorded                   |
 *   | — | the dark ground   | drift    | the peak stands on the site's one dark act, seams and all  |
 *   | 0 | the opening       | reveal   | the page names itself, once                                |
 *   | 1 | before, 2021–23   | draw     | a line is ruled under a chapter that has not been written  |
 *   | 2 | 2024              | wipe     | one thing, arriving whole behind a single edge             |
 *   | 3 | 2025              | flow     | three things, each arriving on its own crossing            |
 *   | 4 | **2026, the peak**| **pin**  | the reader is held while the line they keep is inked       |
 *   | 5 | now               | pen      | the present tense, set at the pace it is read              |
 *   | 6 | the close         | count    | the walk, totalled from the table                          |
 *
 * Seven families across seven beats and two frames — tally, drift, reveal,
 * draw, wipe, flow, pin, count — and no family in two adjacent beats. `reveal`
 * is spent twice, on the two ends of the story, which is the same licence the
 * home page's ledger gives its two bookends, and four beats sit between them.
 *
 * Why each beat gets the device it gets, rather than a rotation:
 *
 * - `draw` on the empty chapter. Nothing in it can arrive, because nothing
 *   has been written; what the page can do honestly is rule the line the
 *   writing will go under. `InkRule` is a hairline drawn by the reader's own
 *   scroll, and it is the only beat on the page with no content in motion.
 * - `wipe` on 2024, and `flow` on 2025, are the arc's own argument made
 *   visible: one thing arrives as one block behind one edge; three things
 *   arrive as three, each when the reader reaches it. Swap them and the
 *   motion contradicts the prose sitting on top of it.
 * - `pin` is the peak. It is the only place the page holds the reader still,
 *   the only dark act, and it buys the most scroll room on the page — the
 *   three things motion-contract §3 says a peak gets and nothing else may.
 *   What happens while held: the lede's first sentence is set and the second,
 *   "something they keep", is inked across from the soft ink to the full ink
 *   by the scroll the reader spends there. It is never unreadable at any
 *   point a reader can park — the floor is `--panel-soft`, 7.86:1 on
 *   `--panel` — so this is emphasis travelling, not text appearing.
 * - `count` at the close, for the same reason the home page's spec plate
 *   counts: a figure that lands from zero is a figure that was counted, and
 *   these three are (see `figures` in `data/story.ts`). It is time-driven and
 *   fires once, so scrolling back does not count the walk down again.
 *
 * - `pen` in the "now" chapter: `motion/Written`, the site's one word-by-word
 *   primitive (#98), so a word is at full ink as it crosses a band in the
 *   lower middle of the window and the present tense arrives at the pace it
 *   is read. This page was waiting for it rather than growing a private copy
 *   — a second word-stagger in the tree is how `WordStagger` was retired
 *   (§7). The family was pencilled in here as `speak`; it is `pen` in the
 *   contract's ledger, and the row above uses the contract's name. Only this
 *   chapter takes it: the years' prose stays plain, so the pen is a change
 *   of register at the present tense rather than the page's texture, and the
 *   ledger carries eight families and still repeats none.
 *
 * Every device on the page answers to motion-contract §4's three
 * off-switches, and each lands on the arrived state: `Rise`, `Flow`,
 * `InkRule` and `InkWipe` carry their own exits, and the two that are this
 * page's own — the peak's ink and the close's count — are argued in
 * `Story.module.css` beside the rules they cancel.
 *
 * THE CHROME
 * ----------
 * `PageShell` calls `usePageCommitted()`, which is what tells the chrome
 * (a layout route since #63, `SiteChrome.tsx`) that this lazy page and its
 * one `data-chrome="dark"` panel are now in the document. Without it a cold
 * visit would leave the bar on paper over the peak's black ground.
 */

/** The opening's mark index, before any chapter — see `YearRail`. */
const OPENING = -1;

function ChapterHead({ chapter, id }: { chapter: Chapter; id: string }) {
  const number = String(chapter.number).padStart(2, "0");
  return (
    <header className={styles.head}>
      {/* The eyebrow carries the span in text, so the year a chapter is about
          is never only in the aria-hidden rail. */}
      <p className={`eyebrow ${styles.kicker}`}>
        <span>Ch. {number}</span>
        <span aria-hidden="true">·</span>
        <span className={styles.span}>{chapter.span}</span>
        {chapter.kicker && (
          <>
            <span aria-hidden="true">·</span>
            <span>{chapter.kicker}</span>
          </>
        )}
      </p>
      <h2 id={id} className={`display ${styles.title}`}>
        {chapter.title}
      </h2>
    </header>
  );
}

function Prose({ paragraphs }: { paragraphs: string[] }) {
  return (
    <div className={styles.prose}>
      {paragraphs.map((p) => (
        <p key={p}>{p}</p>
      ))}
    </div>
  );
}

/**
 * A gap only the author can fill, marked on the page rather than filled
 * with something plausible. See "WHAT IS MARKED RATHER THAN INVENTED" in
 * `data/story.ts`. An `aside`, because it is about the chapter rather than
 * part of its argument, and a reader skimming by landmarks should be able to
 * tell the difference.
 */
function Ask({ chapter }: { chapter: Chapter }) {
  if (!chapter.ask) return null;
  return (
    <aside className={styles.ask} aria-label={chapter.ask.label}>
      <p className={styles.askLabel}>{chapter.ask.label}</p>
      <p>{chapter.ask.question}</p>
    </aside>
  );
}

/**
 * A project inside the argument, not as its subject. The label is the
 * collection's own three-part label, so a project reads the same here as on
 * the wall it came from, and the card goes to that project's page.
 */
function Evidence({ project }: { project: Project }) {
  return (
    <Link to={`/projects/${project.slug}`} className={styles.evidence}>
      {project.image ? (
        <Shot
          src={project.image}
          alt=""
          className={styles.evidenceShot}
          sizes="(min-width: 768px) 30rem, 100vw"
        />
      ) : (
        /* Bothy ships no screenshot and the collection renders a type plate
           instead. Here the label stands alone; a grey box standing in for a
           picture would be the one invented thing on the card. */
        <span className={styles.evidenceBare} aria-hidden="true" />
      )}
      <ObjectLabel name={project.title} fact={project.fact} fields={project.fields} nameAs="h3" scale="inline" />
    </Link>
  );
}

function EvidenceList({ projects }: { projects: Project[] }) {
  return (
    <>
      {projects.map((p) => (
        <Evidence key={p.slug} project={p} />
      ))}
    </>
  );
}

/** Beats 1–3 and 5: a chapter on paper. The device is chosen per chapter in `body`. */
function PaperChapter({ chapter, index, children }: { chapter: Chapter; index: number; children: ReactNode }) {
  const headId = `${chapter.id}-title`;
  return (
    <section
      id={chapter.id}
      aria-labelledby={headId}
      className={`wrap ${styles.chapter}`}
      data-rail-mark={index}
    >
      <ChapterHead chapter={chapter} id={headId} />
      {children}
    </section>
  );
}

/**
 * Beat 4, the peak. The two sentences of the lede are split here, and
 * `data/story.ts` documents that the peak's lede is exactly two.
 */
function PeakChapter({ chapter, index }: { chapter: Chapter; index: number }) {
  const headId = `${chapter.id}-title`;
  const [held, kept] = (chapter.lede ?? "").split(/(?<=\.)\s+/, 2);
  return (
    <DarkAct>
      <section
        id={chapter.id}
        aria-labelledby={headId}
        data-chrome="dark"
        data-rail-mark={index}
        className={`on-panel relative isolate ${styles.peak}`}
      >
        <div className="wrap">
          <ChapterHead chapter={chapter} id={headId} />
        </div>
        {/*
          The run: a static box several screens tall that owns the clock, and
          the held line pinned inside it. motion-contract §1 is the reason for
          the shape — a `view()` timeline on the sticky element itself would
          freeze the moment it pinned — so the timeline is named on this
          static wrapper and the line reads it.
        */}
        <div className={styles.peakRun}>
          <div className={`wrap ${styles.peakHold}`}>
            <p className={styles.peakLine}>
              <span>{held}</span> <span className={styles.peakKeep}>{kept}</span>
            </p>
          </div>
        </div>
        <div className="wrap">
          <Prose paragraphs={chapter.body} />
          <div className={styles.evidenceGrid}>
            <EvidenceList projects={chapter.projects} />
          </div>
          <Ask chapter={chapter} />
        </div>
      </section>
    </DarkAct>
  );
}

/** Beat 6. The count is `Stack.module.css`'s mechanism, restated in this page's module. */
function Close({ figures, index }: { figures: { value: number; caption: string }[]; index: number }) {
  const [plate, counting] = useEnteredOnce<HTMLDListElement>();
  return (
    <section aria-labelledby="close-title" className={`wrap ${styles.close}`} data-rail-mark={index}>
      <h2 id="close-title" className={`display ${styles.title}`}>
        The walk so far
      </h2>
      <p className={styles.closeNote}>
        Counted from the project table rather than typed, the way the specs on the home page are.
      </p>
      <dl ref={plate} className={styles.figures} data-counting={counting ? "" : undefined}>
        {figures.map((f) => (
          <div key={f.caption} className={styles.figure}>
            <dt className={`${styles.figureCaption} text-field`}>{f.caption}</dt>
            <dd
              className={styles.figureValue}
              style={{ "--story-to": f.value, "--story-digits": String(f.value).length } as CSSProperties}
            >
              <span className={styles.count} aria-hidden="true" />
              <span className="sr-only">{f.value}</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className={styles.onward}>
        <Link to="/projects" className={styles.onwardLink}>
          All the work, without the years <span aria-hidden="true">→</span>
        </Link>
      </p>
    </section>
  );
}

export default function Story() {
  const story = useMemo(() => buildStory(), []);
  const root = useRef<HTMLDivElement | null>(null);
  const { chapters } = story;

  /* The device each paper chapter carries, by kind and position — the ledger
     above, made executable. */
  const body = (c: Chapter): ReactNode => {
    if (c.kind === "before") {
      return (
        <>
          <Prose paragraphs={c.body} />
          <InkRule className={styles.draw} />
          <Ask chapter={c} />
        </>
      );
    }
    if (c.kind === "now") {
      return (
        /* No `Rise` round this any more: the pen is how this chapter's
           prose arrives, and a block lifting in while its words are being
           set would be two devices on one beat. The ask is not prose, so it
           is not written; it arrives with the chapter. */
        <div className={styles.prose}>
          {c.body.map((p) => (
            <Written key={p}>{p}</Written>
          ))}
          <Ask chapter={c} />
        </div>
      );
    }
    /* A year. One project arrives behind one edge; several arrive one by
       one. That is the 2024/2025 contrast, and it is decided by the count
       rather than by the year so the rule survives the table changing. */
    return (
      <>
        <Prose paragraphs={c.body} />
        {c.projects.length === 1 ? (
          <InkWipe className={styles.evidenceGrid}>
            <EvidenceList projects={c.projects} />
          </InkWipe>
        ) : (
          <Flow className={`${styles.evidenceGrid} ${styles.flow}`}>
            {c.projects.map((p) => (
              <Evidence key={p.slug} project={p} />
            ))}
          </Flow>
        )}
        <Ask chapter={c} />
      </>
    );
  };

  return (
    <PageShell>
      <div ref={root} className={styles.story}>
        <YearRail chapters={chapters} root={root} firstYear={story.firstYear} />

        <header className={`wrap ${styles.open}`} data-rail-mark={OPENING}>
          <Rise>
            <p className="eyebrow">The story</p>
            <h1 className={`display ${styles.openTitle}`}>The long way round</h1>
            <p className={styles.lede}>
              The collection shows what exists. This is how it got there — the half a list of objects throws
              away.
            </p>
            <p className={`text-field ${styles.sig}`}>
              <span>{chapters.length} chapters</span>
              <span>
                {story.firstYear}–{story.lastYear}
              </span>
            </p>
          </Rise>
        </header>

        {chapters.map((c, i) =>
          c.peak ? (
            <PeakChapter key={c.id} chapter={c} index={i} />
          ) : (
            <PaperChapter key={c.id} chapter={c} index={i}>
              {body(c)}
            </PaperChapter>
          )
        )}

        <Close figures={story.figures} index={chapters.length - 1} />
      </div>
    </PageShell>
  );
}
