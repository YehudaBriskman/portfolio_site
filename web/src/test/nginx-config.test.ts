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
  "cross-origin-opener-policy",
  "cross-origin-resource-policy",
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
    expect(proxied.length).toBe(23);
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

describe("the admin gate's identity headers (oci-free #22)", () => {
  const top = parse(TEMPLATE, SNIPPETS);
  const IDENTITY: Record<string, string> = {
    "x-auth-request-user": "$fwd_auth_request_user",
    "x-auth-request-email": "$fwd_auth_request_email",
    "x-admin-proxy-secret": "$fwd_admin_proxy_secret",
  };

  it("go through the switch from every proxied location, never straight from the client", () => {
    const proxied = locations.filter((loc) => loc.block!.some((d) => d.name === "proxy_pass"));
    const wrong = proxied.flatMap((loc) => {
      const headers = upstreamHeaders(loc);
      return Object.entries(IDENTITY).filter(([h, v]) => headers.get(h) !== v).map(([h]) => `${label(loc)}: ${h}`);
    });
    expect(wrong).toEqual([]);
  });

  it("are dropped unless NGINX_FORWARD_IDENTITY is exactly `on`", () => {
    for (const variable of Object.values(IDENTITY)) {
      const map = top.find((d) => d.name === "map" && d.args[1] === variable);
      expect(map, variable).toBeDefined();
      expect(map!.args[0]).toBe("NGINX_FORWARD_IDENTITY");
      const entries = new Map(map!.block!.map((d) => [d.name, d.args[0]]));
      expect(entries.get("default")).toBe("");
      expect([...entries.keys()].sort()).toEqual(["default", "on"]);
    }
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

  it("lets library videos and captions play: media-src is this origin (#253)", () => {
    // <MediaVideo> asks for /api/images/m/... on this origin, never the
    // absolute public URL, so 'self' is all it needs. Unset falls back to
    // default-src; an explicit media-src must still include 'self'.
    expect(csp.get("media-src") ?? csp.get("default-src")).toContain("'self'");
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
    // Case-insensitive, and the closing tag may carry whitespace or junk
    // (`</SCRIPT >`, `</script foo>`): browsers end the element on all of
    // those, so a narrower pattern would let a real inline script slip past
    // this guard unseen (CodeQL js/bad-tag-filter).
    const inline = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\b[^>]*>/gi)].filter(
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
  const AREA = "location ~ ^/blog/area/([A-Za-z0-9_-]+)/?$";
  const POST = "location ~ ^/blog/([A-Za-z0-9_-]+)/?$";
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

/* ------------------------------------------- every page has a rendered head */

/**
 * The location nginx picks for a URI, by its own order: an exact `=` match
 * wins outright; then the longest prefix, which stops there if it is `^~`;
 * then the first regex in file order; then that longest prefix after all.
 * A query string is not part of the URI matched, so callers pass the path.
 */
function locationFor(uri: string): Directive | undefined {
  const exact = locations.find((loc) => loc.args[0] === "=" && loc.args[1] === uri);
  if (exact) return exact;
  const prefixes = locations
    .filter((loc) => loc.args.length === 1 || loc.args[0] === "^~")
    .filter((loc) => uri.startsWith(loc.args[loc.args.length - 1]))
    .sort((a, b) => b.args[b.args.length - 1].length - a.args[a.args.length - 1].length);
  const longest = prefixes[0];
  if (longest?.args[0] === "^~") return longest;
  const regex = locations.find(
    (loc) => (loc.args[0] === "~" || loc.args[0] === "~*") &&
      new RegExp(loc.args[1], loc.args[0] === "~*" ? "i" : "").test(uri),
  );
  return regex ?? longest;
}

/** Proxied to the API's renderer, with the plain shell as its 5xx fallback. */
function isRendered(loc: Directive | undefined): boolean {
  if (!loc) return false;
  const proxy = loc.block!.find((d) => d.name === "proxy_pass")?.args[0] ?? "";
  const errorPage = loc.block!.find((d) => d.name === "error_page")?.args ?? [];
  return proxy.startsWith("http://$api_upstream/api/seo/render/") && errorPage.at(-1) === "@spa";
}

describe("/story and /accessibility on a direct load (#240)", () => {
  it.each([
    ["/story", "http://$api_upstream/api/seo/render/story"],
    ["/accessibility", "http://$api_upstream/api/seo/render/accessibility"],
  ])("%s has an exact location of its own, proxied to its renderer", (uri, target) => {
    const loc = locationFor(uri)!;
    expect(label(loc)).toBe(`location = ${uri}`);
    expect(loc.block!.find((d) => d.name === "proxy_pass")?.args).toEqual([target]);
    expect(loc.block!.find((d) => d.name === "proxy_intercept_errors")?.args).toEqual(["on"]);
    expect(loc.block!.find((d) => d.name === "error_page")?.args).toEqual(["500", "502", "503", "504", "=", "@spa"]);
  });

  it.each(["/story/", "/accessibility/"])("%s redirects to the page without the slash", (uri) => {
    const ret = locationFor(uri)!.block!.find((d) => d.name === "return")!;
    expect(ret.args).toEqual(["308", uri.slice(0, -1)]);
  });
});

/*
 * Every public route in App.tsx answers a direct load from a rendered
 * location (#238, #240).
 *
 * A route with no location falls through to `location /` and answers 404 with
 * the home page's head, and nobody notices, because the app boots over it and
 * shows the page. /blog/area/<slug>, /story and /accessibility all shipped
 * that way. A new page now fails here until it has a location and a renderer,
 * or is added below with the reason it needs neither.
 */
const APP = read("src/App.tsx");
const ROUTES = [...APP.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]);

/** Routes that answer a direct load without a rendered head, and why. */
const EXEMPT: Record<string, string> = {
  "*": "the catch-all: an unknown path is meant to answer 404",
  "/notes": "legacy: the app redirects it to /blog",
  "/notes/:slug": "legacy: the app redirects it to /blog/<slug>",
  "/blog/c/:project": "legacy: the app redirects it to the project or area",
  "/projects/change11": "removed project: nginx and the app redirect it to /projects",
  "/projects/text-encrypting": "removed project: nginx and the app redirect it to /projects",
  "/admin": "admin: behind the proxy's login, never crawled or shared",
  "/admin/posts": "admin",
  "/admin/posts/:slug": "admin",
  "/admin/areas": "admin",
  "/admin/areas/:slug": "admin",
  "/admin/media": "admin",
  "/admin/settings": "admin: site settings (#254)",
  "/admin/collections/:slug": "admin, and legacy: the app redirects it to /admin/areas/<slug>",
  "/admin/connections": "admin",
  "/admin/projects": "admin: the content editors (#163)",
  "/admin/story": "admin",
  "/admin/site-copy": "admin",
  "/admin/translations": "admin: what is missing or stale in Hebrew (#302)",
  "/admin/marketing": "admin: the marketing hub, once the announce inbox (#474)",
  "/admin/announce": "admin, and legacy: the app redirects it to /admin/marketing",
};

/** A concrete URL for a route pattern: each `:param` becomes a slug-shaped value. */
const sample = (route: string) => route.replace(/:[A-Za-z]+/g, "sample-slug");

describe("every public route has a rendered location (#240)", () => {
  it("reads the routes out of App.tsx", () => {
    // A regex that silently matched nothing would pass everything below.
    expect(ROUTES.length).toBeGreaterThanOrEqual(15);
    expect(ROUTES).toContain("/story");
  });

  it.each(ROUTES.filter((r) => !(r in EXEMPT)))("%s", (route) => {
    const loc = locationFor(sample(route));
    expect({ route, location: loc && label(loc), rendered: isRendered(loc) }).toEqual({
      route,
      location: loc && label(loc),
      rendered: true,
    });
  });

  it.each(ROUTES.filter((r) => !(r in EXEMPT)))("/he%s, its Hebrew twin (#248)", (route) => {
    const uri = route === "/" ? "/he" : `/he${sample(route)}`;
    const loc = locationFor(uri);
    expect({ uri, rendered: isRendered(loc) }).toEqual({ uri, rendered: true });
    expect(loc!.block!.find((d) => d.name === "proxy_pass")?.args).toEqual([
      "http://$api_upstream/api/seo/render/he/$1",
    ]);
  });

  it("names only exemptions that are still routes", () => {
    // An exemption outliving its route would quietly cover the next page that
    // happens to reuse the path.
    expect(Object.keys(EXEMPT).filter((r) => !ROUTES.includes(r))).toEqual([]);
  });
});

/*
 * Removed projects (2026-11-03). Change11 and Text Encrypting were taken off
 * the site, but links to them exist outside it, so both URLs answer a
 * permanent redirect to the index instead of a renderer 404. App.tsx carries
 * the same pair for a link followed inside the app.
 */
describe("removed project URLs redirect to /projects", () => {
  it.each([
    "/projects/change11",
    "/projects/change11/",
    "/projects/text-encrypting",
    "/projects/text-encrypting/",
  ])("%s answers 308 /projects", (uri) => {
    const loc = locationFor(uri)!;
    expect(label(loc)).toBe(`location = ${uri}`);
    expect(loc.block!.find((d) => d.name === "return")?.args).toEqual(["308", "/projects"]);
  });

  it("leaves every other project on its renderer", () => {
    expect(isRendered(locationFor("/projects/icaros"))).toBe(true);
    expect(isRendered(locationFor("/projects/windom/"))).toBe(true);
  });

  it.each(["/projects/change11", "/projects/text-encrypting"])("%s is redirected in the app too", (route) => {
    const line = APP.split("\n").find((l) => l.includes(`path="${route}"`));
    expect(line).toContain('<Navigate to="/projects" replace />');
  });
});

describe("edge config details", () => {
  const top = parse(TEMPLATE, SNIPPETS);

  it("logs errors at warn, because info-level lines carry the query string", () => {
    const level = top.find((d) => d.name === "error_log")!.args[1];
    expect(level).toBe("warn");
  });

  it("keeps subscribe tokens out of the access log and out of Referer", () => {
    const tokenFmt = top.find((d) => d.name === "log_format" && d.args[0] === "token_ext")!;
    expect(tokenFmt.args.join(" ")).toContain("$uri");
    expect(tokenFmt.args.join(" ")).not.toContain("$request ");
    expect(tokenFmt.args.join(" ")).not.toContain("$args");
    const logged = ["= /subscribe/confirm", "= /unsubscribe", "= /subscribe/manage", "^~ /api/subscribe"];
    for (const args of logged) {
      const loc = locations.find((l) => l.args.join(" ") === args);
      expect(loc, args).toBeTruthy();
      const logs = loc!.block!.filter((d) => d.name === "access_log").map((d) => d.args[1]);
      expect(logs, args).toEqual(["token_ext"]);
    }
    // The policy is a map on the original request URI, so the 5xx fallback keeps it.
    const map = top.find((d) => d.name === "map" && d.args[1] === "$referrer_policy")!;
    expect(map.args[0]).toBe("$request_uri");
    const rows = map.block!.map((d) => [d.name, d.args[0]]);
    expect(rows[0]).toEqual(["default", "strict-origin-when-cross-origin"]);
    const rx = new RegExp(rows[1][0].slice(1));
    for (const u of ["/subscribe/confirm?token=a", "/unsubscribe?token=a", "/subscribe/manage", "/api/subscribe/confirm", "/api/subscribe?x=1"])
      expect(rx.test(u), u).toBe(true);
    for (const u of ["/", "/blog/unsubscribe-notes", "/api/subscribers", "/follow"]) expect(rx.test(u), u).toBe(false);
    expect(rows[1][1]).toBe("no-referrer");
    expect(responseHeaders(locations.find((l) => l.args.join(" ") === "= /unsubscribe")!).get("referrer-policy")).toBe("$referrer_policy");
  });

  it("forwards the visitor's scheme, not nginx's own listener scheme", () => {
    const proxied = locations.filter((loc) => loc.block!.some((d) => d.name === "proxy_pass"));
    const wrong = proxied.filter((loc) => upstreamHeaders(loc).get("x-forwarded-proto") !== "$fwd_proto");
    expect(wrong.map(label)).toEqual([]);
    const map = top.find((d) => d.name === "map" && d.args[1] === "$fwd_proto");
    expect(map).toBeDefined();
    expect(map!.args[0]).toBe("$http_x_forwarded_proto");
  });

  it("answers a directory URL with 404 rather than 403", () => {
    const dir = locations.find((l) => l.args.join(" ") === "~ /$");
    expect(dir).toBeDefined();
    expect(dir!.block!.some((d) => d.name === "return" && d.args[0] === "404")).toBe(true);
  });

  it("keeps decoded captures to the slug alphabet", () => {
    const captures = locations.filter((l) => l.args[0] === "~" && /\(\?:?\/?\(|\(\[/.test(l.args[1] ?? ""));
    expect(captures.length).toBeGreaterThan(0);
    for (const l of captures) expect(l.args[1], label(l)).not.toMatch(/\[\^/);
  });
});
