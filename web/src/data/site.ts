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
   */
  shippingSince: 2021,
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
