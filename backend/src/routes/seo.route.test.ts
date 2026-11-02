/*
 * The home page has two heads, and they must agree.
 *
 * nginx sends `/` to /api/seo/render/home, which fetches the built shell and
 * rewrites its head; when the API is down nginx serves the shell as built. A
 * scraper therefore reads either one depending on the moment, and every og: and
 * twitter: tag it can see should be the same in both. #125 found two that were
 * not: the render dropped og:image:type (stripped with the other og: tags and
 * never written back) and wrote the search snippet into og:description, where
 * the shell has its own share-card copy.
 *
 * So this renders the real web/index.html — read from the repository, not a
 * fixture that could drift along with the code — and compares tag by tag.
 * og:url is the one tag allowed to differ in principle (the render builds it
 * from SITE_URL), and on the default SITE_URL it does not differ either.
 */
import fs from "fs";
import path from "path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { resetShellCache } from "../services/seo.js";

const INDEX_HTML = fs.readFileSync(path.resolve(__dirname, "../../../web/index.html"), "utf8");

/** The handful of entities the two heads actually use, decoded so `&middot;` and `·` compare equal. */
function decode(value: string): string {
  return value
    .replace(/&middot;/g, "·")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Every og:* and twitter:* tag in a document's <head>, as key → content. */
function socialTags(html: string): Map<string, string> {
  const head = html.slice(0, html.indexOf("</head>"));
  const tags = new Map<string, string>();
  for (const [, key, content] of head.matchAll(
    /<meta\s+(?:property|name)="((?:og|twitter):[^"]+)"\s+content="([^"]*)"\s*\/?>/g,
  )) {
    tags.set(key, decode(content));
  }
  return tags;
}

describe("GET /api/seo/render/home", () => {
  beforeEach(() => {
    resetShellCache();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).endsWith("/index.html")) {
          return new Response(INDEX_HTML, { status: 200, headers: { "content-type": "text/html" } });
        }
        throw new Error(`unexpected fetch in test: ${url}`);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetShellCache();
  });

  it("writes the same og: and twitter: tags the built shell carries", async () => {
    const res = await request(createApp()).get("/api/seo/render/home");
    expect(res.status).toBe(200);

    const shell = socialTags(INDEX_HTML);
    const rendered = socialTags(res.text);

    // The shell is the reference: a tag it declares must be rendered, with the
    // same content. Checked one by one so a failure names the tag.
    expect(shell.size).toBeGreaterThan(10);
    for (const [key, content] of shell) {
      expect({ key, content: rendered.get(key) }).toEqual({ key, content });
    }
  });

  it("re-adds og:image:type, which stripping the shell's og: tags removed", async () => {
    const res = await request(createApp()).get("/api/seo/render/home");
    expect(res.text.match(/property="og:image:type"/g)).toHaveLength(1);
    expect(res.text).toContain('<meta property="og:image:type" content="image/png" />');
  });

  it("keeps the search snippet in name=description, distinct from the share copy", async () => {
    const res = await request(createApp()).get("/api/seo/render/home");
    const snippet = /<meta name="description" content="([^"]*)"/.exec(INDEX_HTML)?.[1];
    expect(snippet).toBeTruthy();
    expect(res.text).toContain(`<meta name="description" content="${snippet}" />`);
  });
});
