import type { Config } from "tailwindcss";
// `require()` in an ESM, type-checked config is the one thing the lint
// rules actually reject, and it was failing the build before anything ran.
import tailwindcssAnimate from "tailwindcss-animate";
import typography from "@tailwindcss/typography";

const rgb = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1.5rem", screens: { "2xl": "1400px" } },
    extend: {
      colors: {
        ink: rgb("--ink"),
        bitumen: rgb("--bitumen"),
        surface: rgb("--surface"),
        edge: rgb("--edge"),
        bone: rgb("--bone"),
        clay: rgb("--clay"),
        sodium: rgb("--sodium"),
        screen: rgb("--screen"),
        ridge: rgb("--ridge"),
        haze: rgb("--haze"),
        "haze-2": rgb("--haze-2"),
        /* The paper palette's own names. The legacy ones above still
           resolve through index.css while call sites migrate. */
        paper: rgb("--paper"),
        /* A card' material and its lit edge, per theme (#247). */
        sheet: rgb("--sheet"),
        sheen: rgb("--sheen"),
        "paper-2": rgb("--paper-2"),
        "paper-3": rgb("--paper-3"),
        ink: rgb("--ink"),
        "ink-soft": rgb("--ink-soft"),
        "ink-faint": rgb("--ink-faint"),
        rule: rgb("--rule"),
        "rule-firm": rgb("--rule-firm"),
        signal: rgb("--signal"),
        /* Motion only — see the note in index.css. */
        "hue-red": rgb("--hue-red"),
        "hue-blue": rgb("--hue-blue"),
        "hue-green": rgb("--hue-green"),
        "hue-yellow": rgb("--hue-yellow"),
        "hue-purple": rgb("--hue-purple"),
        /* The same hues laid on the paper, for surfaces at rest. */
        "wash-red": rgb("--wash-red"),
        "wash-blue": rgb("--wash-blue"),
        "wash-green": rgb("--wash-green"),
        "wash-yellow": rgb("--wash-yellow"),
        "wash-purple": rgb("--wash-purple"),
        /* The section plates. Named here so a utility can agree with a plate
           — a card that has to sit flush on one, say — but the plates
           themselves are painted by `.ground[data-ground]` in index.css and
           never by a class on a section. */
        "ground-warm": rgb("--ground-warm"),
        "ground-cool": rgb("--ground-cool"),
        // shadcn primitives
        border: rgb("--border"),
        input: rgb("--input"),
        ring: rgb("--ring"),
        background: rgb("--background"),
        foreground: rgb("--foreground"),
        primary: { DEFAULT: rgb("--primary"), foreground: rgb("--primary-foreground") },
        secondary: { DEFAULT: rgb("--secondary"), foreground: rgb("--secondary-foreground") },
        destructive: { DEFAULT: rgb("--destructive"), foreground: rgb("--destructive-foreground") },
        muted: { DEFAULT: rgb("--muted"), foreground: rgb("--muted-foreground") },
        accent: { DEFAULT: rgb("--accent"), foreground: rgb("--accent-foreground") },
        card: { DEFAULT: rgb("--card"), foreground: rgb("--card-foreground") },
      },
      /*
       * One measure and one gutter, named.
       *
       * Every section was writing its own `mx-auto max-w-6xl px-5 sm:px-6
       * py-28 sm:py-36`, which is four decisions repeated at twenty call
       * sites and drifting at most of them — some pages used px-6, some
       * px-5, and the vertical rhythm ran from py-20 to py-36 with no rule
       * behind which. These are the two values the whole site measures
       * against; `.wrap` and `.section-y` in index.css apply them.
       */
      maxWidth: {
        wrap: "72rem",       /* 1152px — the reading and layout measure */
        "wrap-wide": "88rem", /* 1408px — display type and full-bleed media */
      },
      spacing: {
        gutter: "clamp(1.25rem, 3vw, 2.5rem)",
        section: "clamp(4rem, 8vw, 8rem)",
        "section-sm": "clamp(2.5rem, 5vw, 4.5rem)",
      },
      borderRadius: {
        sm: "var(--r-sm)",
        md: "var(--r-md)",
        lg: "var(--r-lg)",
        xl: "var(--r-xl)",
        /* Was a hard 28px, which is off the ladder in index.css — between
           --r-md's 22 and --r-lg's 32 — and had zero call sites, so nothing
           on the site had ever rendered it. It is the plate rung now. */
        "2xl": "var(--r-2xl)",
        full: "var(--r-pill)",
      },
      /*
       * Three roles, and not one family named here.
       *
       * Every entry resolves a custom property, because the family a role
       * points at depends on the document's language and a Tailwind config
       * is evaluated once at build time. The tokens, the six faces they
       * select between, and what each one cost in bytes are in the
       * @font-face note and the token block at the top of index.css.
       *
       * `sans` and `editorial` both mean the text role: the first is what
       * Tailwind's own defaults reach for, the second is the name the call
       * sites use when they mean "quieter than the line above".
       *
       * `mono` is the data role and is no longer a monospace. It keeps the
       * name because the `.mono` utility it backs is on ~65 elements across
       * the app and renaming them is a separate commit; `code` is the
       * generic monospace, for the three places that need characters to
       * line up in a column rather than a voice — a fenced block, an inline
       * literal, and the admin's document-path field.
       */
      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-text)"],
        editorial: ["var(--font-text)"],
        mono: ["var(--font-data)"],
        code: ["var(--font-code)"],
      },
      fontSize: {
        /*
         * Two registers and a hole.
         *
         * The references this is drawn from have nothing between roughly 24px
         * and 80px — tiny labels, giant display, and a different *voice* in
         * between rather than a middle size. The previous ceiling of 9rem was
         * the top of a continuous ramp, which is why nothing on the page ever
         * read as the most important thing on it.
         */
        /*
         * Sized from the face, not from taste. "BRISKMAN" and "GET IN TOUCH"
         * are the two longest strings the site sets in this register; the
         * hero runs full-bleed so its budget is the viewport less its
         * gutters, and the section heads live in the 1152px column. Both
         * clamps were the largest value that still fitted the longer string
         * at every width, which is why they are not round numbers.
         *
         * Re-measured in the DOM at each face's own shipped tracking, by
         * scripts/fontwork/strings.mjs:
         *
         *                          BRISKMAN   GET IN TOUCH
         *   Archivo wdth 125/900   6.92em     8.98em
         *   Audiowide -0.030em     5.91em     7.70em
         *   Rubik Glitch 0         5.59em     7.19em
         *
         * Both display faces are narrower than the setting these clamps were
         * cut for, so both clamps now have slack rather than being tight.
         * They are left as they are: they were chosen against a budget and
         * the budget has not moved, and growing a headline because the face
         * shrank is how a ramp stops being a ramp.
         */
        /*
         * The hero answers to the window's height as well as its width.
         *
         * `12vw` alone only knows how wide the window is, so on a short wide
         * one — a laptop at 1878x875, say — the name grew to 225px and its
         * two lines took 43% of everything the reader could see before a
         * single word of the page had been said. Capping with `vh` makes the
         * block hold at roughly a third of the viewport whatever shape the
         * window is, and the rem ceiling stops it running away on a large
         * display.
         *
         * 9rem was also the largest size at which "BRISKMAN" — 6.92em in
         * Archivo at wdth 125 — still fitted the measure's 1072px of
         * content, which is what lets the name sit inside the column with
         * air at both sides instead of running edge to edge; 10rem overran
         * it by 67px. In Audiowide at 5.91em the same 9rem sets 851px, so
         * the ceiling is no longer the binding constraint — the vh cap
         * above is.
         */
        /*
         * Every step carries its own tracking and leading, because a size
         * without them is only two thirds of a type decision. Tracking
         * tightens as the size grows and leading runs inverse to it; the
         * measured source for the ramp is in index.css next to the tokens.
         */
        hero: ["min(11vw, 21vh, 9rem)", { lineHeight: "0.86", letterSpacing: "var(--track-display)" }],
        /* The floor is `min(2.2rem, 10vw)` (#99): a section head is often one
           long word ("ACCESSIBILITY") in a face about 0.63em per capital, so
           a rem floor alone ran it off a 390px screen at Larger text, and
           off a 320px one at the default. 10vw keeps the word inside the
           gutters; from 375px up at the default size the rem floor still
           wins and nothing changes. */
        section: ["clamp(min(2.2rem, 10vw), 7vw, 7rem)", { lineHeight: "0.9", letterSpacing: "var(--track-display)" }],
        /* An object's own name. Below the section head, above the fact line. */
        object: ["clamp(1.5rem, 3.4vw, 2.2rem)", { lineHeight: "1.06", letterSpacing: "var(--track-head)" }],
        /* The quiet register, sized to sit under a section head. */
        sub: ["clamp(1.25rem, 3.2vw, 2rem)", { lineHeight: "1.2", letterSpacing: "var(--track-sub)" }],
        /* The fact line: prose, one sentence, never a paragraph. */
        fact: ["clamp(1rem, 1.4vw, 1.125rem)", { lineHeight: "1.5", letterSpacing: "var(--track-body)" }],
        /* The field line. The only place the data role is the whole voice
           of a block. */
        field: ["0.72rem", { lineHeight: "1.5", letterSpacing: "var(--track-field)" }],
      },
    },
  },
  plugins: [tailwindcssAnimate, typography],
} satisfies Config;
