import { describe, expect, it } from "vitest";
import { HOME_TITLE, documentTitleFor, humaniseSlug, pageIdentityFor } from "@/lib/pageTitle";
import { projects } from "@/data/projects";

/*
 * The resolver is the half of the route announcement that can be checked
 * without a browser, so it is checked here exhaustively and the component test
 * is left to prove only that the three effects fire.
 *
 * The strings are not arbitrary and that is what most of these assert.
 * `backend/src/routes/seo.route.ts` already rewrites the head per URL for
 * crawlers and writes `Work · Yehuda Briskman`, `Blogs · Yehuda Briskman`
 * and `Not found · Yehuda Briskman`; a reader and a crawler seeing two
 * different titles for one address is the bug the per-route title was supposed
 * to fix, so these are the server's own strings written down a second time on
 * purpose. If the server's change, these fail, which is the point.
 */

describe("the name a route gives itself", () => {
  it("titles every public route differently, including the one that is nowhere", () => {
    const titles = ["/", "/projects", "/blog", "/nothing-is-here"].map(
      (p) => pageIdentityFor(p).title
    );
    /* The measured failure this exists to prevent: all four of these were one
       byte-identical string, so a screen-reader user was told the same thing
       wherever they landed, including when they landed nowhere. */
    expect(new Set(titles).size).toBe(4);
    expect(titles).toEqual([
      HOME_TITLE,
      "Work · Yehuda Briskman",
      "Blogs · Yehuda Briskman",
      "Not found · Yehuda Briskman",
    ]);
  });

  it("keeps the shell's own title on the home page rather than restating the name", () => {
    /* "Home · Yehuda Briskman" would say the name twice and drop the line that
       says what the person does. The announcement is still the short word. */
    expect(pageIdentityFor("/")).toEqual({ name: "Home", title: HOME_TITLE });
  });

  it("announces a name and not a sentence", () => {
    expect(pageIdentityFor("/projects").name).toBe("Work");
    expect(pageIdentityFor("/blog").name).toBe("Blogs");
    expect(pageIdentityFor("/nope").name).toBe("Not found");
  });

  it("says Blogs where the route says blog", () => {
    /* The route is `/blog` only because links to that address are already
       out in the world. The room's name is Blogs (#222) — the bar, the
       page's eyebrow and the footer all say it — and the title is not the
       place to contradict them. */
    expect(pageIdentityFor("/blog").title).toBe("Blogs · Yehuda Briskman");
  });

  it("names the story route by the bar's word for it", () => {
    expect(pageIdentityFor("/story")).toEqual({
      name: "Journey",
      title: "Journey · Yehuda Briskman",
    });
  });

  it("names a project out of the same table the plates come from", () => {
    for (const p of projects) {
      expect(pageIdentityFor(`/projects/${p.slug}`)).toEqual({
        name: p.title,
        title: `${p.title} · Yehuda Briskman`,
      });
    }
  });

  it("falls back to the slug for a collection the seed table has never seen", () => {
    /* A published collection outranks the seed, so a project page can exist
       for a slug that is not in `data/projects.ts`. The page corrects the
       title itself once the fetch lands; this is what the tab says until then,
       and it is not allowed to be "Not found". */
    expect(pageIdentityFor("/projects/something-new").name).toBe("Something new");
  });

  it("reads a note's slug as a sentence while its real title is still in flight", () => {
    expect(pageIdentityFor("/blog/why-ci-must-fail").name).toBe("Why ci must fail");
    expect(humaniseSlug("a_mixed-separator_slug")).toBe("A mixed separator slug");
    /* Percent-encoding is legal in a slug and a malformed escape throws out of
       `decodeURIComponent`. A page name is not worth a crash. */
    expect(humaniseSlug("caf%C3%A9-notes")).toBe("Café notes");
    expect(humaniseSlug("%E0-broken")).toBe("%E0 broken");
    expect(humaniseSlug("")).toBe("");
  });

  it("resolves a redirect route to what it redirects to, not to a 404", () => {
    /*
     * These four render a `<Navigate replace>` and no page at all, so the
     * reader is on them for one commit. The catch-all would have called every
     * one of them "Not found" — announcing a failure in the middle of a
     * redirect that worked — and giving them the destination's identity also
     * means the live region is written the same string twice, which React
     * turns into no second announcement at all.
     */
    expect(pageIdentityFor("/notes").name).toBe("Blogs");
    expect(pageIdentityFor("/notes/some-note").name).toBe(
      pageIdentityFor("/blog/some-note").name
    );
    expect(pageIdentityFor("/blog/c/icaros").name).toBe("Icaros");
    expect(pageIdentityFor("/admin").name).toBe("Overview");
    expect(pageIdentityFor("/admin/collections/site").name).toBe(
      pageIdentityFor("/admin/areas/site").name
    );
  });

  it("names the admin pages, and marks them as the admin in the tab only", () => {
    expect(pageIdentityFor("/admin/posts")).toEqual({
      name: "Posts",
      title: "Posts · Admin · Yehuda Briskman",
    });
    expect(pageIdentityFor("/admin/areas").name).toBe("Areas");
    /* Every page in the admin's nav has its own name (#288). */
    expect(pageIdentityFor("/admin/media").name).toBe("Media");
    expect(pageIdentityFor("/admin/site-copy").name).toBe("Site copy");
    expect(pageIdentityFor("/admin/posts/new").name).toBe("New post");
    expect(pageIdentityFor("/admin/areas/new").name).toBe("New area");
    expect(pageIdentityFor("/admin/posts/why-ci-must-fail").name).toBe(
      "Editing Why ci must fail"
    );
    /* The public site has a page called Notes and the admin has a list called
       Posts for the same rows; someone with both open has two tabs to tell
       apart, and the announcement does not need the word because inside the
       admin every page would carry it. */
    expect(pageIdentityFor("/admin/areas").title).toBe("Areas · Admin · Yehuda Briskman");
  });

  it("treats a trailing slash and a deep stray path as the addresses they are", () => {
    expect(pageIdentityFor("/projects/").name).toBe("Work");
    /* Three segments under /projects matches no route, so it is the 404 — the
       resolver must not fall back to naming the page after its first segment,
       which would title a dead address as if it worked. */
    expect(pageIdentityFor("/projects/icaros/extra").name).toBe("Not found");
    expect(pageIdentityFor("/blog/a/b/c").name).toBe("Not found");
  });

  it("composes a title the same way wherever it is composed", () => {
    /* `hooks/useDocumentTitle.ts` builds titles for pages that learn their own
       name, and it has to produce the same shape this does or a note's title
       changes format the moment its fetch lands. */
    expect(documentTitleFor("Icaros")).toBe(pageIdentityFor("/projects/icaros").title);
  });
});
