/* Replaces paragraphs.ts. Every sentence here should survive a hiring manager
   asking "prove it". No adjectives that can't be checked. */

export const contact = {
  email: "yehuda@yehudabriskman.com",
  location: "Tel Aviv, Israel",
  availability: "Open to interesting conversations",
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
