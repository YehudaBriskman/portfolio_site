import { describe, expect, it } from "vitest";
import { applyHead, headUrl, markServedFeeds } from "@/lib/headSync";

describe("HeadSync (#308)", () => {
  it("asks the API for the page's head in its language", () => {
    expect(headUrl("/", "en")).toBe("/api/seo/head/home");
    expect(headUrl("/", "he")).toBe("/api/seo/head/he");
    expect(headUrl("/blog/a-note", "en")).toBe("/api/seo/head/blog/a-note");
    expect(headUrl("/projects/", "he")).toBe("/api/seo/head/he/projects");
  });

  it("swaps the managed tags and leaves the title and everything else alone", () => {
    document.head.innerHTML = [
      "<title>Kept</title>",
      '<meta name="description" content="old" />',
      '<link rel="canonical" href="https://x/old" />',
      '<meta property="og:title" content="old" />',
      '<script type="application/ld+json">{"old":true}</script>',
      '<link rel="alternate" type="application/rss+xml" href="/feed.xml" />',
      '<meta name="theme-color" content="#000" />',
    ].join("");
    markServedFeeds(document.head);
    const react = document.createElement("link");
    Object.assign(react, { rel: "alternate", type: "application/rss+xml", href: "/api/seo/feed/log.xml" });
    document.head.append(react);

    applyHead(document.head, [
      "<title>Ignored</title>",
      '<meta name="description" content="new" />',
      '<link rel="canonical" href="https://x/new" />',
      '<meta property="og:title" content="new" />',
      '<script type="application/ld+json">{"new":true}</script>',
      '<link rel="alternate" type="application/rss+xml" title="Log" href="https://x/api/seo/feed/log.xml" />',
    ]);

    expect(document.title).toBe("Kept");
    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1);
    expect(document.head.querySelector('meta[name="description"]')!.getAttribute("content")).toBe("new");
    expect(document.head.querySelector('link[rel="canonical"]')!.getAttribute("href")).toBe("https://x/new");
    expect(document.head.querySelector('script[type="application/ld+json"]')!.textContent).toBe('{"new":true}');
    expect(document.head.querySelector('meta[name="theme-color"]')).not.toBeNull();
    /* The served feed went; React's stayed, and was not linked twice. */
    const feeds = [...document.head.querySelectorAll('link[type="application/rss+xml"]')];
    expect(feeds).toEqual([react]);
  });
});
