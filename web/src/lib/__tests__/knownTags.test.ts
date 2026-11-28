import { describe, expect, it } from "vitest";
import { knownTagsOf } from "@/lib/knownTags";

/* #827: the editor's tag suggestions are read by a person, so they are in
   dictionary order, not code-unit order (which puts every capital first). */
describe("knownTagsOf", () => {
  it("lists each tag once, in dictionary order", () => {
    expect(knownTagsOf([{ tags: ["dns", "Rust"] }, { tags: ["ci", "dns"] }])).toEqual(["ci", "dns", "Rust"]);
  });
});
