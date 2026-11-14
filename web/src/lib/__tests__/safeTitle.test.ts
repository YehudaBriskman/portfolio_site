import { describe, expect, it } from "vitest";
import { titleOf } from "../safeTitle";

describe("titleOf", () => {
  it("keeps a real title", () => expect(titleOf("Hello", "hello")).toBe("Hello"));
  it.each([["   "], ["​​"], ["‎‏"], ["﻿"], ["⁠ ­"], [""], [null], [undefined]])(
    "falls back to the slug for %j",
    (t) => expect(titleOf(t as never, "the-slug")).toBe("the-slug"),
  );
  it("falls back to the given word when the slug is unreadable too", () => {
    expect(titleOf(" ", "​", "Untitled")).toBe("Untitled");
    expect(titleOf(null, undefined, "Untitled")).toBe("Untitled");
  });
  it("does not strip a joiner that is part of a real word", () => {
    expect(titleOf("a‍b", "s")).toBe("a‍b");
  });
});
