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
        xl: "var(--r-lg)",
        "2xl": "28px",
        full: "var(--r-pill)",
      },
      fontFamily: {
        display: ["Archivo", "ui-sans-serif", "system-ui", "sans-serif"],
        editorial: ["Instrument Serif", "Georgia", "Times New Roman", "serif"],
        sans: ["IBM Plex Sans", "ui-sans-serif", "system-ui", "sans-serif"],
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
        hero: ["clamp(2.4rem, 12vw, 13rem)", { lineHeight: "0.84" }],
        section: ["clamp(2.2rem, 7vw, 7rem)", { lineHeight: "0.88" }],
        /* The quiet register, sized to sit under a section head. */
        sub: ["clamp(1.25rem, 3.2vw, 2rem)", { lineHeight: "1.16" }],
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
