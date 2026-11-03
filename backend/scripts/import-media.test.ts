import { describe, expect, it } from "vitest";
// @ts-expect-error -- a plain .mjs script, run with node; vitest loads it as is.
import { relink, staticRef } from "./import-media.mjs";

/*
 * The migration's second phase (#253 after #163): which strings are static
 * content pictures, and how a content document is pointed at the library.
 */

const LIB: Record<string, string> = {
  "windom.jpg": "https://yehudabriskman.com/api/images/media/windom-01a68d",
  "yehuda-cut.webp": "https://yehudabriskman.com/api/images/media/yehuda-cut-d99a59",
};
const urlFor = (rel: string) => LIB[rel.split("/").pop()!] ?? null;
const ORIGINS = ["https://yehudabriskman.com"];

describe("staticRef", () => {
  it("knows a master and its variants, as a path or on the site's origin", () => {
    expect(staticRef("/projects/windom.jpg")).toBe("projects/windom.jpg");
    expect(staticRef("/projects/windom-1200.jpg")).toBe("projects/windom.jpg");
    expect(staticRef("/img/yehuda-cut-sm.webp")).toBe("img/yehuda-cut.webp");
    expect(staticRef("https://yehudabriskman.com/projects/windom.jpg", ORIGINS)).toBe("projects/windom.jpg");
  });

  it("leaves what is not one alone", () => {
    expect(staticRef("https://elsewhere.example/projects/windom.jpg", ORIGINS)).toBeNull();
    expect(staticRef("See /projects/windom.jpg for a picture")).toBeNull();
    expect(staticRef("/fonts/x.woff2")).toBeNull();
    expect(staticRef("/projects/windom")).toBeNull();
    expect(staticRef(null)).toBeNull();
  });
});

describe("relink", () => {
  it("swaps each static picture for its library URL and says where", () => {
    const doc = {
      items: [
        { slug: "windom", image: "/projects/windom.jpg", summary: { en: "Uses /projects/windom.jpg" } },
        { slug: "icaros", image: "/projects/icaros.jpg" },
        { slug: "none", image: null },
      ],
    };
    const { next, changes, unmatched } = relink(doc, urlFor, ORIGINS);
    expect(next.items[0].image).toBe(LIB["windom.jpg"]);
    expect(next.items[0].summary.en).toBe("Uses /projects/windom.jpg");
    expect(next.items[2].image).toBeNull();
    expect(changes).toEqual([{ path: "items.0.image", from: "/projects/windom.jpg", to: LIB["windom.jpg"] }]);
    // Not in the library: reported and kept, never dropped.
    expect(unmatched).toEqual([{ path: "items.1.image", from: "/projects/icaros.jpg" }]);
    expect(next.items[1].image).toBe("/projects/icaros.jpg");
    // The input is not mutated.
    expect(doc.items[0].image).toBe("/projects/windom.jpg");
  });

  it("finds a picture in a record keyed by beat, and a variant that names a master", () => {
    const story = { images: { intro: { src: "/img/yehuda-cut-sm.webp", alt: { en: "Yehuda" } } } };
    const { next, changes } = relink(story, urlFor);
    expect(next.images.intro).toEqual({ src: LIB["yehuda-cut.webp"], alt: { en: "Yehuda" } });
    expect(changes[0].path).toBe("images.intro.src");
  });

  it("a document already on the library has nothing to change", () => {
    const { changes, unmatched } = relink({ image: LIB["windom.jpg"] }, urlFor, ORIGINS);
    expect(changes).toEqual([]);
    expect(unmatched).toEqual([]);
  });
});
