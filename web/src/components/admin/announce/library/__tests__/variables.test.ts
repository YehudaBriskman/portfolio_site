import { describe, expect, it } from "vitest";
import { builtinTemplate } from "../defaults";
import { fill, insertAt, newId, SAMPLE, tidy } from "../variables";

describe("fill", () => {
  it("fills every variable once and does not expand a value that contains one", () => {
    const v = { ...SAMPLE.en, title: "uses {url} literally" };
    expect(fill("{title} | {first_name} | {version}", v)).toBe("uses {url} literally | Dana | v1.6.0");
  });
  it("leaves unknown braces alone", () => {
    expect(fill("{nope} {title}", SAMPLE.en)).toBe(`{nope} ${SAMPLE.en.title}`);
  });
  it("tidies blank runs and trailing spaces like the server", () => {
    expect(tidy("a \n\n\n\nb\n")).toBe("a\n\nb");
  });
});

describe("insertAt", () => {
  it("replaces the selection and returns the caret after the piece", () => {
    expect(insertAt("hello world", "{title}", 6, 11)).toEqual({ text: "hello {title}", caret: 13 });
  });
  it("clamps a caret that is out of range", () => {
    expect(insertAt("ab", "X", 9, 9).text).toBe("abX");
  });
});

describe("ids and defaults", () => {
  it("makes ids the server accepts", () => {
    for (let i = 0; i < 20; i++) expect(newId("t")).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
  });
  it("has a built-in for every language and channel, with the url where the channel can carry it", () => {
    for (const l of ["en", "he"] as const)
      for (const c of ["linkedin", "instagram", "email", "gmail", "x"] as const) expect(builtinTemplate(l, c)).toContain("{title}");
    expect(builtinTemplate("en", "x")).toContain("{url}");
  });
});
