// @vitest-environment node
/*
 * What nginx actually sends, worked out from the config the image ships.
 *
 * nginx has two inheritance rules that are easy to read past in review and have
 * each cost this site something real:
 *
 *  - `add_header` in a location replaces the server's whole set rather than
 *    adding to it (#79). Five blocks served their responses with no HSTS, no
 *    nosniff, no Referrer-Policy and no CSP for as long as they had existed.
 *  - `proxy_set_header` does exactly the same (#121). The eight SEO locations
 *    each set a Host, so none of them inherited anything, and none of them
 *    listed X-Forwarded-For — the API saw nginx as the client.
 *
 * CI's preflight already greps for the first rule. This goes further and
 * computes the headers each location ends up with, the way nginx does —
 * includes expanded, the location's own set if it has one, the server's if it
 * has none — so it holds for a header added to the snippet tomorrow, and for a
 * location that drops its include as well as one that never had it.
 *
 * Node environment: this reads files from the repository and touches no DOM.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const WEB = path.resolve(__dirname, "../..");
const read = (file: string) => fs.readFileSync(path.join(WEB, file), "utf8");

/* ------------------------------------------------------------- a small parser */

type Directive = { name: string; args: string[]; block?: Directive[] };

/** Splits nginx syntax into words, quoted strings, `{`, `}` and `;`, dropping comments. */
function tokenize(src: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "#") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "{" || c === "}" || c === ";") { tokens.push(c); i++; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1;
      let out = "";
      while (j < src.length && src[j] !== c) {
        if (src[j] === "\\") { out += src[j + 1]; j += 2; continue; }
        out += src[j++];
      }
      tokens.push(out);
      i = j + 1;
      continue;
    }
    let j = i;
    while (j < src.length && !/[\s{};]/.test(src[j])) j++;
    tokens.push(src.slice(i, j));
    i = j;
  }
  return tokens;
}

/** Builds the directive tree, expanding `include` of the snippets the image ships. */
function parse(src: string, snippets: Record<string, Directive[]> = {}): Directive[] {
  const tokens = tokenize(src);
  let pos = 0;
  function list(): Directive[] {
    const out: Directive[] = [];
    while (pos < tokens.length && tokens[pos] !== "}") {
      const name = tokens[pos++];
      const args: string[] = [];
      while (tokens[pos] !== ";" && tokens[pos] !== "{") args.push(tokens[pos++]);
      if (tokens[pos] === "{") {
        pos++;
        const block = list();
        pos++; // the closing brace
        out.push({ name, args, block });
      } else {
        pos++; // the semicolon
        if (name === "include" && snippets[args[0]]) out.push(...snippets[args[0]]);
        else out.push({ name, args });
      }
    }
    return out;
  }
  return list();
}

const SNIPPETS = {
  "/etc/nginx/snippets/security-headers.conf": parse(read("security-headers.conf")),
  "/etc/nginx/snippets/proxy-headers.conf": parse(read("proxy-headers.conf")),
};
// The image's entrypoint runs envsubst over NGINX_* before nginx reads the
// file; stand in a value for each, or `${` reads as the start of a block.
const TEMPLATE = read("nginx.conf.template").replace(/\$\{(NGINX_[A-Z_]+)\}/g, "$1");
const server = parse(TEMPLATE, SNIPPETS).find((d) => d.name === "server")!.block!;
const locations = server.filter((d) => d.name === "location");
const label = (loc: Directive) => `location ${loc.args.join(" ")}`;

/** The headers nginx sends from a location: its own add_header set, or the server's if it has none. */
function responseHeaders(loc: Directive): Map<string, string> {
  const own = loc.block!.filter((d) => d.name === "add_header");
  const set = own.length ? own : server.filter((d) => d.name === "add_header");
  return new Map(set.map((d) => [d.args[0].toLowerCase(), d.args[1]]));
}

/** The same rule for proxy_set_header. */
function upstreamHeaders(loc: Directive): Map<string, string> {
  const own = loc.block!.filter((d) => d.name === "proxy_set_header");
  const set = own.length ? own : server.filter((d) => d.name === "proxy_set_header");
  return new Map(set.map((d) => [d.args[0].toLowerCase(), d.args[1]]));
}

const SECURITY_HEADERS = [
  "strict-transport-security",
  "x-content-type-options",
  "referrer-policy",
  "content-security-policy",
  "permissions-policy",
];

/* ------------------------------------------------------------------- tests */

describe("nginx config", () => {
  it("parses into a server with the locations it is known to have", () => {
    // A parser that silently found nothing would pass every test below.
    expect(locations.length).toBeGreaterThanOrEqual(20);
    expect(locations.map(label)).toContain("location = /feed.xml");
  });

  it("sends every security header from every location (#79)", () => {
    const missing = locations.flatMap((loc) => {
      const headers = responseHeaders(loc);
      return SECURITY_HEADERS.filter((h) => !headers.has(h)).map((h) => `${label(loc)}: ${h}`);
    });
    expect(missing).toEqual([]);
  });

  it("forwards the client address from every proxied location (#121)", () => {
    const proxied = locations.filter((loc) => loc.block!.some((d) => d.name === "proxy_pass"));
    expect(proxied.length).toBe(10);
    const wrong = proxied.flatMap((loc) => {
      const headers = upstreamHeaders(loc);
      // $proxy_add_x_forwarded_for appends nginx's peer (Traefik) to what
      // Traefik sent, which is the two-hop chain backend/src/app.ts counts.
      // $remote_addr alone would drop the client and keep only Traefik.
      return headers.get("x-forwarded-for") === "$proxy_add_x_forwarded_for" ? [] : [label(loc)];
    });
    expect(wrong).toEqual([]);
  });
});

describe("Content-Security-Policy (#124)", () => {
  const csp = new Map(
    responseHeaders(locations[0])
      .get("content-security-policy")!
      .split(";")
      .map((d) => d.trim().split(/\s+/))
      .filter((parts) => parts[0])
      .map(([name, ...values]) => [name, values]),
  );

  it("allows scripts from this origin only — no inline script, no eval", () => {
    expect(csp.get("script-src")).toEqual(["'self'"]);
    expect(csp.get("default-src")).toEqual(["'self'"]);
  });

  it("closes the directives default-src does not cover", () => {
    expect(csp.get("object-src")).toEqual(["'none'"]);
    expect(csp.get("base-uri")).toEqual(["'none'"]);
    expect(csp.get("frame-ancestors")).toEqual(["'none'"]);
    expect(csp.get("form-action")).toEqual(["'self'"]);
  });

  it("needs nothing for the shell's only inline script, which is JSON-LD data", () => {
    // script-src 'self' holds only while every inline <script> in the shell is
    // a data block the browser never executes. A real inline script added to
    // index.html would be refused in production; this says so at test time.
    const html = read("index.html");
    const inline = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter(
      ([, attrs]) => !/\bsrc=/.test(attrs),
    );
    expect(inline.length).toBeGreaterThan(0);
    for (const [, attrs, body] of inline) {
      expect(attrs).toMatch(/type="application\/ld\+json"/);
      expect(() => JSON.parse(body)).not.toThrow();
    }
  });
});

describe("Permissions-Policy (#124)", () => {
  const policy = responseHeaders(locations[0]).get("permissions-policy")!;

  it("switches off the powerful features the site never uses", () => {
    for (const feature of ["camera", "microphone", "geolocation", "payment", "usb"]) {
      expect(policy).toMatch(new RegExp(`(^|, )${feature}=\\(\\)`));
    }
  });

  it("leaves on the two the share button needs", () => {
    // ReadingBar calls navigator.share and falls back to clipboard.writeText.
    expect(policy).not.toMatch(/web-share=/);
    expect(policy).not.toMatch(/clipboard-write=/);
  });
});

describe("/feed.xml when the API fails (#125)", () => {
  const feed = locations.find((loc) => label(loc) === "location = /feed.xml")!;
  const errorPage = feed.block!.find((d) => d.name === "error_page")!;
  const target = errorPage.args[errorPage.args.length - 1];
  const fallback = locations.find((loc) => loc.args[0] === target)!;

  it("intercepts every 5xx", () => {
    expect(errorPage.args).toEqual(expect.arrayContaining(["500", "502", "503", "504"]));
    expect(feed.block!.find((d) => d.name === "proxy_intercept_errors")?.args).toEqual(["on"]);
  });

  it("never falls back to the HTML shell", () => {
    expect(target).not.toBe("@spa");
    expect(fallback).toBeDefined();
    expect(fallback.block!.some((d) => d.name === "try_files")).toBe(false);
  });

  it("answers a 503 a feed reader will retry, in a type nothing parses as a page", () => {
    const ret = fallback.block!.find((d) => d.name === "return")!;
    expect(Number(ret.args[0])).toBe(503);
    expect(fallback.block!.find((d) => d.name === "default_type")?.args[0]).toBe("text/plain");
    // default_type loses to the mime table, and the URI still ends in .xml:
    // without an empty `types` block nginx sends this sentence as text/xml.
    expect(fallback.block!.find((d) => d.name === "types")?.block).toEqual([]);
    expect(responseHeaders(fallback).get("retry-after")).toMatch(/^\d+$/);
  });
});

describe("/blog/area/<slug> on a direct load (#238)", () => {
  const AREA = "location ~ ^/blog/area/([^/.]+)/?$";
  const POST = "location ~ ^/blog/([^/.]+)/?$";
  const area = locations.find((loc) => label(loc) === AREA);
  const regexes = locations.filter((loc) => loc.args[0] === "~" || loc.args[0] === "~*");
  /** nginx's choice among regex locations: the first in the file that matches. */
  const firstRegex = (uri: string) => {
    const hit = regexes.find((loc) => new RegExp(loc.args[1], loc.args[0] === "~*" ? "i" : "").test(uri));
    return hit ? label(hit) : undefined;
  };

  it("has a location of its own, proxied to the area renderer", () => {
    expect(area).toBeDefined();
    expect(area!.block!.find((d) => d.name === "proxy_pass")?.args).toEqual([
      "http://$api_upstream/api/seo/render/blog/area/$1",
    ]);
  });

  it("is where an area URL lands, with or without a trailing slash", () => {
    // A query string is not part of the URI a location matches, so
    // `?topic=x` lands in the same place.
    for (const uri of ["/blog/area/windom", "/blog/area/windom/", "/blog/area/site"]) {
      expect(firstRegex(uri)).toBe(AREA);
    }
  });

  it("leaves posts, the log, files and deeper paths where they were", () => {
    expect(firstRegex("/blog/log")).toBe(POST);
    expect(firstRegex("/blog/some-post")).toBe(POST);
    expect(firstRegex("/blog/area/x/extra")).toBeUndefined();
    // A post slugged "area", which there is none of: the renderer's 404.
    expect(firstRegex("/blog/area/")).toBe(POST);
    expect(firstRegex("/blog/area/card.png")).not.toBe(AREA);
  });

  it("falls back to the shell on a 5xx and lets the renderer's 404 through", () => {
    const errorPage = area!.block!.find((d) => d.name === "error_page")!;
    expect(errorPage.args).toEqual(["500", "502", "503", "504", "=", "@spa"]);
    expect(area!.block!.find((d) => d.name === "proxy_intercept_errors")?.args).toEqual(["on"]);
  });

  it("sends the security headers and forwards the client like the other rendered pages", () => {
    const headers = responseHeaders(area!);
    expect(SECURITY_HEADERS.filter((h) => !headers.has(h))).toEqual([]);
    expect(upstreamHeaders(area!).get("x-forwarded-for")).toBe("$proxy_add_x_forwarded_for");
  });
});
