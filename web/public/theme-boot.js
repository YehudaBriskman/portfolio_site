/*
 * The theme, before first paint (#247).
 *
 * A classic script, loaded from index.html's <head> with no `defer`, `async`
 * or `type="module"`, and that is the whole point of it: the parser stops
 * here, runs this, and only then reaches <body>, so the first frame is
 * already in the reader's theme. A module script is deferred by definition
 * and may run after a paint, which is the flash this file exists to prevent.
 * It is external rather than inline because the CSP is `script-src 'self'`
 * (security-headers.conf); an inline copy would need a hash pinned to its
 * bytes.
 *
 * It writes the RESOLVED theme — "light" or "dark", never "system" — to
 * `data-theme` on <html>, so index.css carries one dark block and System is
 * resolved in one place per side. `src/lib/theme.ts` takes over once React
 * runs, and a test in `src/lib/__tests__/theme.test.ts` executes this file
 * to hold the two to the same answer.
 *
 * Plain ES5 and no dependencies: it runs before anything else exists.
 */
(function () {
  var root = document.documentElement;
  var choice = null;
  try {
    choice = window.localStorage.getItem("yb-theme");
  } catch (e) {
    /* Storage blocked (a private window, a sandbox): use the default. */
  }
  if (choice !== "light" && choice !== "dark" && choice !== "system") {
    var meta = document.querySelector('meta[name="site-theme-default"]');
    choice = meta ? meta.getAttribute("content") : null;
  }
  if (choice !== "light" && choice !== "dark") {
    var dark = false;
    try {
      dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch (e) {
      /* No matchMedia: light, the site's original ground. */
    }
    choice = dark ? "dark" : "light";
  }
  root.setAttribute("data-theme", choice);
  var color = document.querySelector('meta[name="theme-color"]');
  if (color) color.setAttribute("content", choice === "dark" ? "#1C1A16" : "#ECE8DC");
})();
