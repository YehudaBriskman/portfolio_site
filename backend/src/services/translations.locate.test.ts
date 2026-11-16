import { locate } from "./translations.js";

describe("site-copy lookup by id", () => {
  it("finds a real section", () => {
    expect(locate("site-copy", { hero: { en: "x" } }, "hero", "en")).toBe("x");
  });

  it.each(["__proto__", "constructor", "toString", "hasOwnProperty"])("does not treat the inherited name %j as a section", (id) => {
    expect(locate("site-copy", {}, id, "hasOwnProperty")).toBeUndefined();
    expect(locate("site-copy", { [id]: { en: "x" } }, id, "en")).toBeUndefined();
  });
});
