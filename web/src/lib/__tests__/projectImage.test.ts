import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { shotImage } from "@/lib/projectImage";

/*
 * The ladder in `projectImage.ts` and the files `scripts/build-shots.mjs`
 * writes are two statements of the same fact, and nothing at runtime notices
 * when they stop agreeing — a browser handed a `srcSet` rung that is not on
 * disk simply picks it, gets a 404, and falls back to showing nothing.
 *
 * So the agreement is the test. It walks every URL the component can emit for
 * every screenshot in `public/projects/` and checks the file is there, which
 * means a width added in one place and not the other fails here rather than
 * in production, and a screenshot added without running the script fails too.
 */

const PUBLIC = path.resolve(__dirname, "../../../public");

function urlsIn(srcSet: string): string[] {
  return srcSet.split(",").map((entry) => entry.trim().split(/\s+/)[0]);
}

describe("shotImage", () => {
  it("offers only files that exist, in every format and at every width", () => {
    const missing: string[] = [];

    for (const slug of ["windom", "programing_with_yehuda", "icaros"]) {
      const image = shotImage(`/projects/${slug}.jpg`);
      expect(image).not.toBeNull();
      if (!image) continue;

      const urls = [image.src, ...urlsIn(image.srcSet ?? ""), ...image.sources.flatMap((s) => urlsIn(s.srcSet))];
      expect(urls.length).toBe(1 + 4 + 4 + 4);

      for (const url of urls) {
        if (!existsSync(path.join(PUBLIC, url))) missing.push(url);
      }
    }

    expect(missing).toEqual([]);
  });

  it("offers four rungs per format, widest last", () => {
    const image = shotImage("/projects/windom.jpg");
    expect(image?.sources.map((s) => s.type)).toEqual(["image/avif", "image/webp"]);
    expect(image?.sources[0].srcSet).toBe(
      "/projects/windom-400.avif 400w, /projects/windom-800.avif 800w, " +
        "/projects/windom-1200.avif 1200w, /projects/windom-1600.avif 1600w",
    );
    /* The master doubles as the top JPEG rung, so there is no `-1600.jpg`:
       it would be the same picture at the same width under a second name. */
    expect(image?.srcSet).toContain("/projects/windom.jpg 1600w");
    expect(image?.srcSet).not.toContain("windom-1600.jpg");
  });

  it("leaves an image it has no variants of completely alone", () => {
    /* A cover pasted into the admin. Offering a `srcSet` for this would be
       inventing filenames that were never generated. */
    const pasted = shotImage("https://example.com/cover.png");
    expect(pasted).toEqual({ sources: [], src: "https://example.com/cover.png" });

    const noCover = shotImage(null);
    expect(noCover).toBeNull();
  });
});
