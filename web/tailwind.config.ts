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
        "2xl": "28px",
        full: "var(--r-pill)",
      },
      /*
       * Two families. Display carries voice, text carries prose, and a third
       * is a costume — the reasoning, and what it cost to find out, is in the
       * @font-face note at the top of index.css.
       *
       * Archivo answers to both `display` and `sans`; the two differ by width
       * axis, not by file. `editorial` survives as a name so the call sites
       * that mean "quieter than the line above" keep working, and it now
       * resolves to the family the page actually has.
       */
      fontFamily: {
        display: ["Archivo", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["Archivo", "ui-sans-serif", "system-ui", "sans-serif"],
        editorial: ["Archivo", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
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
         * Sized from the face, not from taste. Measured at wdth 125 / weight
         * 900, "BRISKMAN" is 7.12em wide and "GET IN TOUCH" is 9.28em — the
         * two longest strings the site sets in this register. The hero runs
         * full-bleed so its budget is the viewport less its gutters, and the
         * section heads live in the 1152px column. Both clamps are the
         * largest value that still fits the longer string at every width,
         * which is why they are not round numbers.
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
         * 9rem is also the largest size at which "BRISKMAN" — 7.12em at
         * wdth 125 — still fits the measure's 1072px of content, which is
         * what lets the name sit inside the column with air at both sides
         * instead of running edge to edge. 10rem overran it by 67px.
         */
        /*
         * Every step carries its own tracking and leading, because a size
         * without them is only two thirds of a type decision. Tracking
         * tightens as the size grows and leading runs inverse to it; the
         * measured source for the ramp is in index.css next to the tokens.
         */
        hero: ["min(11vw, 21vh, 9rem)", { lineHeight: "0.86", letterSpacing: "var(--track-display)" }],
        section: ["clamp(2.2rem, 7vw, 7rem)", { lineHeight: "0.9", letterSpacing: "var(--track-display)" }],
        /* An object's own name. Below the section head, above the fact line. */
        object: ["clamp(1.5rem, 3.4vw, 2.2rem)", { lineHeight: "1.06", letterSpacing: "var(--track-head)" }],
        /* The quiet register, sized to sit under a section head. */
        sub: ["clamp(1.25rem, 3.2vw, 2rem)", { lineHeight: "1.2", letterSpacing: "var(--track-sub)" }],
        /* The fact line: prose, one sentence, never a paragraph. */
        fact: ["clamp(1rem, 1.4vw, 1.125rem)", { lineHeight: "1.5", letterSpacing: "var(--track-body)" }],
        /* The field line. The only place the mono is allowed to appear. */
        field: ["0.72rem", { lineHeight: "1.5", letterSpacing: "var(--track-field)" }],
      },
      keyframes: {
        "fade-up": { from: { opacity: "0", transform: "translateY(14px)" }, to: { opacity: "1", transform: "none" } },
        "pulse-soft": { "0%,100%": { opacity: "0.35" }, "50%": { opacity: "1" } },
      },
      animation: {
        "fade-up": "fade-up 0.7s cubic-bezier(0.16,1,0.3,1) both",
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate, typography],
} satisfies Config;
