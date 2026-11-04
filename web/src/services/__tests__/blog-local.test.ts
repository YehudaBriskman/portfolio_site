import { describe, expect, it } from "vitest";
import { local } from "@/services/blog";

/*
 * A note on a Hebrew page (#248, #306): each translated field replaces its
 * English, and a link's Hebrew label replaces its label but keeps its address.
 */
const note = {
  title: "Building the site",
  links: [
    { label: "Source", url: "https://example.com/src" },
    { label: "Demo", url: "https://example.com/demo" },
  ],
  he: { title: "בניית האתר", "links.0.label": "קוד מקור", "links.1.label": "" } as Record<string, string | null>,
};

describe("local()", () => {
  it("puts each Hebrew link label in place of its English, and keeps the address", () => {
    const he = local(note, "he");
    expect(he.title).toBe("בניית האתר");
    expect(he.links).toEqual([
      { label: "קוד מקור", url: "https://example.com/src" },
      { label: "Demo", url: "https://example.com/demo" },
    ]);
    expect(Object.keys(he)).not.toContain("links.0.label");
  });

  it("leaves an English page as it is", () => {
    expect(local(note, "en")).toBe(note);
  });
});
