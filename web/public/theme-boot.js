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
  /* The owner's accent preset (#254), from the meta the API's render
     writes. Only a known preset is applied; `ink` is the stylesheet's own
     and needs no attribute. The list is src/settings/accents.ts's, and a
     test holds the two equal. */
  var accentMeta = document.querySelector('meta[name="site-accent"]');
  var accent = accentMeta ? accentMeta.getAttribute("content") : null;
  if (accent === "pine" || accent === "plum" || accent === "rust") root.setAttribute("data-accent", accent);
  var color = document.querySelector('meta[name="theme-color"]');
  if (color) color.setAttribute("content", choice === "dark" ? "#1C1A16" : "#ECE8DC");

  /*
   * The two viewer controls (#99), for the same reason: text size and
   * contrast change the first frame as much as the theme does. Keys, values
   * and the System rule match `src/lib/viewerPrefs.ts`; the theme test runs
   * this file and holds the two to the same answers.
   */
  var size = null;
  var contrast = null;
  try {
    size = window.localStorage.getItem("yb-text-size");
    contrast = window.localStorage.getItem("yb-contrast");
  } catch (e) {
    /* Storage blocked: the defaults. */
  }
  if (size !== "large" && size !== "larger") size = "default";
  if (contrast !== "standard" && contrast !== "more") {
    var more = false;
    try {
      more = window.matchMedia("(prefers-contrast: more)").matches;
    } catch (e) {
      /* No matchMedia: standard. */
    }
    contrast = more ? "more" : "standard";
  }
  root.setAttribute("data-text-size", size);
  root.setAttribute("data-contrast", contrast);
})();
