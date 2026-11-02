/* Replaces paragraphs.ts. Every sentence here should survive a hiring manager
   asking "prove it". No adjectives that can't be checked. */

export const contact = {
  email: "yehuda@yehudabriskman.com",
  location: "Tel Aviv, Israel",
  availability: "Open to interesting conversations",
  /* A duration, so it lives here rather than in the markup — the label schema
     forbids a count or a duration being typed into a component. It is also a
     promise, which is the other reason it belongs in one place: it has to be
     changed in one place when it stops being true. */
  replyWithin: "Usually within a day",
};

/*
 * Object zero: the collection names itself.
 *
 * The title plate carries the same three-part label as every project and every
 * note — name, one line of fact, a mono field line — and the rules about what
 * may go in it are on the type in `components/gallery/objectLabel.ts`. The one
 * that bit hardest here: fact, not pitch. This used to open with "Built to be
 * used.", which is a claim, and a claim on the first screen of a gallery is the
 * single thing that breaks the grammar — every other label on the page states
 * what a thing is and refuses to argue for it, so this one does too.
 *
 * Only the parts that cannot be counted live here. The numbers on the field
 * line are derived in `Hero.tsx` from `data/projects.ts`, because a count typed
 * into content is a count that is wrong the first time the table changes and
 * nobody notices.
 */
export const plate = {
  /** The collection's own name. Set uppercase by the plate scale, not here. */
  name: "Yehuda Briskman",
  /** One line of fact: what the thing is, in the fewest words that are true. */
  fact: "Full-stack, mostly frontend",
  /**
   * Where the work is done, and the country rather than the city on purpose:
   * `contact.location` already says Tel Aviv for anyone who needs it, and a
   * field line is read cropped, so the first field has to be the one that
   * still means something on its own.
   */
  where: "Israel",
  /**
   * The first year there was shipped work to point at.
   *
   * Stated rather than derived, and the only number on the plate that is.
   * `data/projects.ts` starts in 2024 because that is as far back as its six
   * entries go, not because nothing shipped before them — deriving this from
   * the table would print a career that began two years after it did.
   *
   * Confirmed by the author, which is the only way this one can be checked.
   * Every other figure on the plate recomputes itself when the table changes;
   * this one does not, so it is the one to re-ask about rather than trust.
   */
  shippingSince: 2021,
};

/*
 * The two title treatments issue #100 asks to choose between, and the thing
 * they displace.
 *
 * `plate.name` above is still "Yehuda Briskman" and is still what `main`
 * ships. These are proposals: the owner's ask was that the `h1` becomes
 * PORTFOLIO set very large, or EXPLORE MY PORTFOLIO a little less large, and
 * both are built so the choice can be made from renders.
 *
 * WHAT CHANGES BESIDES THE STRING
 * -------------------------------
 * The name leaves the `h1`, and the `h1` is the page's accessible name and
 * its strongest on-page signal. So each of these carries the name in its
 * fact line instead — the label schema's second slot, "what the thing is",
 * which is exactly the slot a category label needs filling in. Set in the
 * accent face at 18px rather than in display type at the 158px PORTFOLIO
 * measures at 1440x900, which is a real loss and is the cost of the trade
 * rather than a thing to hide.
 *
 * It is not the only place the name lives, and that is what makes the trade
 * survivable: `index.html` carries it in `<title>`, in `meta[name=author]`,
 * in `og:title`, in `og:site_name`, in `twitter:title` and twice in the
 * JSON-LD graph, as the Person's `name` and the WebSite's. Every one of
 * those was checked against these strings and none of them had to move,
 * because none of them ever said "portfolio" — they say who the site is by.
 *
 * Cased here and uppercased by the plate scale, as `plate.name` is, so the
 * accessible name a screen reader announces is a sentence rather than a
 * shout.
 */
export type PlateTitle = { name: string; fact: string };

/*
 * The name and the field it works in, one line, with the name first.
 *
 * Shared by both options deliberately: the thing the `h1` stops saying is
 * the same thing in both cases, so the sentence that recovers it should not
 * differ between them. An em dash and not a full stop, because this is one
 * statement — who, then what — rather than two sentences in a slot the
 * schema describes as "a sentence".
 */
const NAMED_FACT = `${plate.name} — full-stack, mostly frontend`;

export const plateTitles: Record<"portfolio" | "explore", PlateTitle> = {
  /*
   * Nine characters, one word, 6.41em in Audiowide at the display tracking —
   * re-measured in the DOM, see the rung in `Hero.module.css`. One word
   * cannot break, so this is one line at every width the site has, which is
   * most of what makes it read as "very large".
   */
  portfolio: { name: "Portfolio", fact: NAMED_FACT },
  /*
   * Twenty characters in three words, 13.98em on one line and 7.29em on its
   * longest line when it breaks after "MY". It breaks at every width, which
   * is why it is the option that is a little less large.
   */
  explore: { name: "Explore my portfolio", fact: NAMED_FACT },
};

export const about = {
  heading: "How I work",
  intro: [
    "I'm a full-stack engineer and a team leader at the Israel Defense Forces, in Tel Aviv. I lead a small team building and running internal software, and I still write and review code every day. I never wanted the version of the job where you stop.",
    "Before that I was a full-stack engineer at Momentum Tailored Solutions.",
    "Outside work I ship my own products end to end: WindoM, a Chrome extension published in the Web Store, and Bothy, a console that reports what's running by asking Docker rather than by reading a list someone has to remember to update.",
  ],
  /* Three claims, each defensible in an interview because each is a thing that
     actually exists in a repository. */
  principles: [
    {
      claim: "Install from empty, every time",
      detail:
        "Every pull request on Bothy clones the repository into an empty directory, runs the three-line install and nothing else, then runs every test in the tree against whatever came up. A nightly job repeats it at a path with a space in it and at a six-level-deep path, because every portability bug that repo has had looked fine at exactly one path.",
    },
    {
      claim: "A check that cannot fail is not a check",
      detail:
        "One CI job exists only to plant a mutation and require another job to catch it. A green suite and a suite that is incapable of going red look identical from the outside, so I make the difference explicit.",
    },
    {
      claim: "Generated, never committed",
      detail:
        "Credentials are generated at install time rather than shipped as placeholders to fill in. The bootstrap prints which keys it wrote and never their values, so there is no default password to forget about.",
    },
  ],
};
