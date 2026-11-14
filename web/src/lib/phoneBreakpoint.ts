/*
 * The ONE phone breakpoint of the public site (docs/public-mobile-guide.md, R1).
 * 640px is Tailwind's `sm`, so `sm:` utilities and `@media (max-width: 639px)`
 * switch at the same width. The admin keeps its own 600px hook (`usePhone`).
 * Public CSS that still uses another width is listed in the guard test's
 * allow-list and moves here in later PRs.
 */
export const PUBLIC_PHONE_BREAKPOINT = 640;
export const PUBLIC_PHONE_QUERY = `(max-width: ${PUBLIC_PHONE_BREAKPOINT - 1}px)`;
