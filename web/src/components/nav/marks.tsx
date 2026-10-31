import type { ComponentType, SVGProps } from "react";

/*
 * The marks, drawn rather than imported.
 *
 * These were lucide's `Github`, `Linkedin` and `Mail`, which are stroked
 * icons from a drawing set: one 2px-wide pen, rounded caps, everything built
 * to look like a member of the same family. That is the right answer for the
 * glyphs inside a control — the pause icon, the chevron — and the wrong one
 * for these two, because GitHub's and LinkedIn's marks are not icons of the
 * idea of GitHub and LinkedIn. They are logotypes, they are filled, and they
 * are among the most recognised shapes on a hiring surface. Drawn as 2px
 * outlines they lose the thing that makes them legible at 19px, which is
 * their silhouette.
 *
 * So the paths are the real ones, filled with `currentColor`, which is what
 * lets the whole bar invert over the dark act without this file knowing that
 * the dark act exists.
 *
 * Accessibility is not in this file, deliberately. Every mark renders
 * `aria-hidden` by default and the accessible name lives on the control
 * wrapping it — a logo is not a name, and a screen reader handed an unlabelled
 * path announces "link" and nothing else. See `Marks.tsx` and the `label`
 * field in `social.ts`.
 */

export type Mark = ComponentType<SVGProps<SVGSVGElement>>;

/* `focusable="false"` is for IE/legacy Edge, where an inline <svg> inside a
   link is its own tab stop; it costs nothing and the alternative is a
   keyboard user tabbing twice through every mark. */
const base = {
  "aria-hidden": true,
  focusable: false,
  fill: "currentColor",
} as const;

/** The GitHub mark (Octicon `mark-github`, the published logotype). */
export function GithubMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" {...base} {...props}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.07-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A7.995 7.995 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

/** The LinkedIn mark — the rounded square with the `in`, as published. */
export function LinkedinMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.04c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13Zm1.78 13.02H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
    </svg>
  );
}

/**
 * The envelope.
 *
 * Not a logotype — nobody owns email — but it is set with the two that are,
 * so it is filled rather than stroked: three marks in a row at 19px, one of
 * them hollow, reads as a loading state.
 */
export function MailMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...base} {...props}>
      <path d="M21 4H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 3.7-8.47 5.3a1 1 0 0 1-1.06 0L3 7.7V6.3l9 5.63 9-5.63v1.4Z" />
    </svg>
  );
}
