import { describe, expect, it } from "vitest";
import { cardUrl, entityPath, entityUrl, gmailComposeUrl, linkedInShareUrl, localePath, mailtoUrl, safeOrigin, whatsappShareUrl, xShareUrl } from "@/lib/share";

describe("third-party link formats", () => {
  const url = "https://example.test/blog/a";

  it("LinkedIn share-offsite takes only the url", () => {
    expect(linkedInShareUrl(url)).toBe("https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fexample.test%2Fblog%2Fa");
  });

  it("X takes the url and the text as separate parameters", () => {
    expect(xShareUrl(url, "A & B")).toBe("https://x.com/intent/post?url=https%3A%2F%2Fexample.test%2Fblog%2Fa&text=A%20%26%20B");
  });

  it("WhatsApp takes one text", () => {
    expect(whatsappShareUrl("hi there\n" + url)).toBe("https://wa.me/?text=hi%20there%0Ahttps%3A%2F%2Fexample.test%2Fblog%2Fa");
  });

  it("Gmail compose is view=cm with su and body", () => {
    expect(gmailComposeUrl("Hello & bye", "line1\nline2")).toBe("https://mail.google.com/mail/?view=cm&fs=1&su=Hello%20%26%20bye&body=line1%0Aline2");
  });

  it("mailto has no recipient and CRLF line breaks", () => {
    expect(mailtoUrl("Hello & bye", "line1\nline2")).toBe("mailto:?subject=Hello%20%26%20bye&body=line1%0D%0Aline2");
  });
});

describe("addresses", () => {
  it("builds paths from kind and slug only", () => {
    expect(entityPath("post", "a-b")).toBe("/blog/a-b");
    expect(entityPath("note", "a-b")).toBe("/blog/a-b");
    expect(entityPath("area", "ci")).toBe("/blog/area/ci");
    expect(entityPath("project", "windom")).toBe("/projects/windom");
    expect(entityPath("release", "windom")).toBe("/projects/windom");
    expect(entityPath("story")).toBe("/story");
    expect(entityPath("home")).toBe("/");
  });

  it("encodes the slug as one segment", () => {
    expect(entityPath("post", "a/b?c#d")).toBe("/blog/a%2Fb%3Fc%23d");
    expect(entityPath("post", "רשימה")).toBe("/blog/%D7%A8%D7%A9%D7%99%D7%9E%D7%94");
  });

  it("refuses a missing slug and dot segments", () => {
    expect(() => entityPath("post")).toThrow(RangeError);
    expect(() => entityPath("post", "")).toThrow(RangeError);
    expect(() => entityPath("project", "..")).toThrow(RangeError);
    expect(() => entityPath("project", ".")).toThrow(RangeError);
  });

  it("puts Hebrew under /he", () => {
    expect(localePath("/blog/a", "he")).toBe("/he/blog/a");
    expect(localePath("/", "he")).toBe("/he");
    expect(localePath("/blog/a", "en")).toBe("/blog/a");
  });

  it("accepts only plain http(s) origins and trims them to the origin", () => {
    expect(safeOrigin("https://example.test/")).toBe("https://example.test");
    expect(safeOrigin("http://localhost:5173")).toBe("http://localhost:5173");
    expect(safeOrigin("https://example.test/some/path?x=1")).toBe("https://example.test");
    for (const bad of ["", "javascript:alert(1)", "//evil.test", "ftp://x.test", "https://user:pw@example.test", "not a url"]) {
      expect(() => safeOrigin(bad), bad).toThrow(RangeError);
    }
  });

  it("adds utm tags in a fixed order, cleaned", () => {
    expect(entityUrl("https://example.test", "/blog/a", { source: "Site Share!", medium: "linkedin" })).toBe(
      "https://example.test/blog/a?utm_source=site-share-&utm_medium=linkedin",
    );
    expect(entityUrl("https://example.test", "/", { source: "", medium: "x" })).toBe("https://example.test/?utm_source=share&utm_medium=x");
  });

  it("builds card addresses for kinds that have a card", () => {
    expect(cardUrl("https://example.test", "post", "a", "og")).toBe("https://example.test/api/seo/og/blog/a.png");
    expect(cardUrl("https://example.test", "project", "w", "square")).toBe("https://example.test/api/seo/og/projects/w.png?format=square");
    expect(cardUrl("https://example.test", "home", undefined, "og")).toBeUndefined();
  });
});
