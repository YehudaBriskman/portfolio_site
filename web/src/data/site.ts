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
  /**
   * The owner's name, written once. It is not the plate's `h1` — that is
   * `plateTitle` below — but the subject of its fact line, and the string
   * every other place on the site that names him is checked against.
   */
  name: "Yehuda Briskman",
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
 * What the plate's `h1` says: PORTFOLIO, set very large — the owner's pick
 * from issue #100, over EXPLORE MY PORTFOLIO and over the name `main` used
 * to set there.
 *
 * WHAT CHANGED BESIDES THE STRING
 * -------------------------------
 * The name left the `h1`, and the `h1` is the page's accessible name and its
 * strongest on-page signal. So the name is carried in the fact line instead —
 * the label schema's second slot, "what the thing is", which is exactly the
 * slot a category label leaves unanswered. Set in the accent face at 18px
 * rather than in display type at the 158px PORTFOLIO measures at 1440x900,
 * which is a real loss and is the cost of the trade rather than a thing to
 * hide.
 *
 * It is not the only place the name lives, and that is what makes the trade
 * survivable: `index.html` carries it in `<title>`, in `meta[name=author]`,
 * in `og:title`, in `og:site_name`, in `twitter:title` and twice in the
 * JSON-LD graph, as the Person's `name` and the WebSite's. None of those had
 * to move, because none of them ever said "portfolio" — they say who the
 * site is by.
 *
 * `name`: nine characters, one word, 6.41em in Audiowide at the display
 * tracking — measured in the DOM, see the rung in `Hero.module.css`. One word
 * cannot break, so it is one line at every width the site has, which is most
 * of what makes it read as very large. Cased here and uppercased by the plate
 * scale, so the accessible name a screen reader announces is a word rather
 * than a shout.
 *
 * `fact`: the name and the field it works in, with the name first. An em dash
 * and not a full stop, because this is one statement — who, then what —
 * rather than two sentences in a slot the schema describes as "a sentence".
 * Assembled from `plate.name`, so the name is written in this file once.
 */
export const plateTitle = {
  name: "Portfolio",
  fact: `${plate.name} — full-stack, mostly frontend`,
} as const;

/*
 * What the light in the hero's end corner says, one phrase at a time.
 *
 * The owner's brief for that corner: "a modern light circle or something like
 * that, maybe some nice comments like 'Technology'", in the voice of his
 * GitHub profile README — "Full-Stack Engineer · Technical Lead · Product
 * Builder", and its motto, "Build boldly. Question assumptions. Keep
 * improving." These are that voice, cut to what fits beside a light.
 *
 * NOT A DATASHEET
 * ---------------
 * The corner used to carry a fact with a label over it. These are not facts
 * and do not pretend to be: they are the README's asides, which is why they
 * are set in the text face and the soft ink rather than in the field line's
 * voice — a phrase dressed as a spec would be a sixth fact on a screen whose
 * field line is capped at three.
 *
 * THE EMPLOYER IS NEVER NAMED ON THIS SITE. The owner's current employer is
 * not public information — not here, not in `about.intro`, not in the
 * crawlable echo in `backend/src/routes/seo.route.ts`, not in a render under
 * `docs/`. Say what the work is, never whose it is. The corner these phrases
 * replace once named it, which is how that rule came to be written.
 *
 * WHY THEY ARE SHORT
 * ------------------
 * At 320px the corner frame is 278px and the ask in the other corner needs
 * 104px of it, so the longest phrase here sets the end block's width and has
 * to leave the ask room: "Product builder" is about 115px in the text face at
 * 0.875rem, and every phrase is held to roughly that. A longer one would not
 * wrap — the phrases are `nowrap`, because a phrase that breaks while it
 * fades reads as two — it would squeeze the ask instead. Re-shoot at 320
 * after changing this list.
 *
 * The first phrase is the one shown when motion is off and before the hero
 * has finished arriving, so it is the one that has to stand on its own.
 */
export const heroPhrases = [
  "Technology",
  "Product builder",
  "Build boldly",
  "Applied AI",
  "Keep improving",
] as const;

/*
 * "How I work", as short sections read the way /story is read (#157).
 *
 * Every `lines` entry is one paragraph, written by the pen on its own clock,
 * so a line is kept to a sentence or two: a short paragraph gets more scroll
 * per word, and the section reads as a run of beats rather than as a wall.
 * The words are the ones the section has always carried, cut at sentence
 * boundaries and not rewritten, so the crawlable echo in
 * `backend/src/routes/seo.route.ts` still says the same thing.
 *
 * The role is "technical team lead" and nothing more specific — see the
 * employer rule above `heroPhrases`.
 */
export type ApproachSection = { label: string; lines: string[] };
export type ApproachPrinciple = { claim: string; lines: string[] };

export const about: {
  heading: string;
  intro: ApproachSection[];
  principles: ApproachPrinciple[];
} = {
  heading: "How I work",
  intro: [
    {
      label: "Now",
      lines: [
        "I'm a full-stack engineer and a technical team lead in Tel Aviv.",
        "I lead a small team building and running internal software, and I still write and review code every day. I never wanted the version of the job where you stop.",
      ],
    },
    {
      label: "Before",
      lines: ["Before that I was a full-stack engineer at Momentum Tailored Solutions."],
    },
    {
      label: "Outside work",
      lines: [
        "Outside work I ship my own products end to end: WindoM, a Chrome extension published in the Web Store, and Bothy, a console that reports what's running by asking Docker rather than by reading a list someone has to remember to update.",
      ],
    },
  ],
  /* Three claims, each defensible in an interview because each is a thing that
     actually exists in a repository. */
  principles: [
    {
      claim: "Install from empty, every time",
      lines: [
        "Every pull request on Bothy clones the repository into an empty directory, runs the three-line install and nothing else, then runs every test in the tree against whatever came up.",
        "A nightly job repeats it at a path with a space in it and at a six-level-deep path, because every portability bug that repo has had looked fine at exactly one path.",
      ],
    },
    {
      claim: "A check that cannot fail is not a check",
      lines: [
        "One CI job exists only to plant a mutation and require another job to catch it.",
        "A green suite and a suite that is incapable of going red look identical from the outside, so I make the difference explicit.",
      ],
    },
    {
      claim: "Generated, never committed",
      lines: [
        "Credentials are generated at install time rather than shipped as placeholders to fill in.",
        "The bootstrap prints which keys it wrote and never their values, so there is no default password to forget about.",
      ],
    },
  ],
};
