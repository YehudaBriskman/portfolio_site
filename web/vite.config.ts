// vite.config.ts
import { defineConfig, type Plugin, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import type { IncomingMessage, ServerResponse } from "http";
import { SITE_THEME_DEFAULT } from "./src/lib/themeDefault";

function color(code: number) {
  return (s: string) => `\x1b[${code}m${s}\x1b[0m`;
}
const grey = color(90);
const green = color(32);
const yellow = color(33);
const red = color(31);
const cyan = color(36);
const magenta = color(35);

function statusColor(status: number) {
  if (status >= 500) return red;
  if (status >= 400) return yellow;
  return green;
}
function startClock() {
  const t0 = Date.now();
  return () => Date.now() - t0;
}
function makeIdGen() {
  let n = 0;
  return () => {
    n = (n + 1) % Number.MAX_SAFE_INTEGER;
    return n || 1;
  };
}
const nextId = makeIdGen();

/** A module id inside one of the named packages' own directories. */
function pkg(...names: string[]) {
  const alt = names.map((n) => n.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")).join("|");
  return new RegExp(`[\\\\/]node_modules[\\\\/](?:${alt})[\\\\/]`);
}

function apiProxy(target: string): ProxyOptions {
  return {
    target,
    changeOrigin: true,
    ws: true,
    rewrite: (p) => p.replace(/^\/api/, ""),
  };
}

function requestLoggerPlugin(apiBase: string): Plugin {
  return {
    name: "request-logger",
    configureServer(server) {
      server.middlewares.use(
        (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => {
          const id = nextId();
          const method = (req.method ?? "GET").toUpperCase();
          const url = req.url ?? "/";
          const t = startClock();

          const upstream =
            url.startsWith("/api")
              ? `${apiBase}${url.replace(/^\/api/, "")}`
              : "static (vite)";

          console.log(`${grey(`[${id}]`)} ${magenta("→ received")} ${method} ${url} ${cyan(`upstream=${upstream}`)}`);

          res.on("finish", () => {
            const ms = t();
            const sc = statusColor(res.statusCode || 0);
            console.log(
              `${grey(`[${id}]`)} ${sc("← responded")} ${method} ${url} ${sc(String(res.statusCode || "-"))} ${grey(`${ms}ms`)}`
            );
          });

          next();
        }
      );
    },
  };
}

/*
 * Writes the commit into the shell's <meta name="build-sha"> (#200).
 *
 * BUILD_SHA is the Dockerfile's build-arg; a local build has none and says
 * `dev`. Anything that is not a hex sha is also `dev`, because the value is
 * written into HTML and a build-arg is not the place to discover that.
 */
/*
 * Writes the site default theme into <meta name="site-theme-default"> (#247),
 * from the one constant in src/lib/themeDefault.ts. "pre" for the same
 * reason as the sha below.
 */
function siteThemePlugin(): Plugin {
  return {
    name: "site-theme-default",
    transformIndexHtml: {
      order: "pre",
      handler: (html) => html.replaceAll("%SITE_THEME_DEFAULT%", SITE_THEME_DEFAULT),
    },
  };
}

function buildShaPlugin(): Plugin {
  const raw = process.env.BUILD_SHA ?? "";
  const sha = /^[0-9a-f]{7,40}$/.test(raw) ? raw : "dev";
  return {
    name: "build-sha",
    // "pre", so it runs ahead of Vite's own %ENV% substitution, which
    // would otherwise warn that BUILD_SHA is not one of its variables.
    transformIndexHtml: { order: "pre", handler: (html) => html.replaceAll("%BUILD_SHA%", sha) },
  };
}

/*
 * One `<meta name="route-preload">` per lazy page, naming what that page needs
 * that the entry does not already preload: its chunk, the chunks it imports,
 * and its CSS.
 *
 * Every public page but the home is behind `lazy()`, so on a cold load its
 * chunk was discovered only after the bundle had run and React had rendered the
 * route — a round trip spent behind the entry shutter. The API renders each
 * content URL's head (backend/src/services/seo.ts, routePreloadLinks), turns
 * the meta for that URL's page into preload links and drops the rest. A meta
 * fetches nothing, so the plain shell pays only its bytes.
 *
 * Build only: the dev server has no bundle, writes no metas, and the API then
 * adds no preloads.
 */
function routePreloadPlugin(): Plugin {
  return {
    name: "route-preload",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        const bundle = ctx.bundle;
        if (!bundle) return html;
        const chunks = new Map<string, { imports: string[]; css: string[] }>();
        let entry: string | null = null;
        const pages: [string, string][] = [];
        for (const out of Object.values(bundle)) {
          if (out.type !== "chunk") continue;
          const meta = (out as { viteMetadata?: { importedCss?: Set<string> } }).viteMetadata;
          chunks.set(out.fileName, { imports: out.imports, css: [...(meta?.importedCss ?? [])] });
          if (out.isEntry) entry = out.fileName;
          const page = /[\\/]src[\\/]pages[\\/](\w+)\.tsx$/.exec(out.facadeModuleId ?? "")?.[1];
          if (page && out.isDynamicEntry && !page.startsWith("Admin")) pages.push([page, out.fileName]);
        }
        const closure = (root: string, into = new Set<string>()) => {
          if (into.has(root) || !chunks.has(root)) return into;
          into.add(root);
          for (const dep of chunks.get(root)!.imports) closure(dep, into);
          return into;
        };
        const preloaded = entry ? closure(entry) : new Set<string>();
        const tags = pages
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([page, file]) => {
            const js = [...closure(file)].filter((f) => !preloaded.has(f));
            const css = js.flatMap((f) => chunks.get(f)!.css);
            const files = [...js, ...new Set(css)].map((f) => `/${f}`).join(" ");
            return `    <meta name="route-preload" data-route="${page}" content="${files}" />`;
          });
        if (tags.length === 0) return html;
        return html.replace(/\s*<\/head>/, () => `\n${tags.join("\n")}\n  </head>`);
      },
    },
  };
}

export default defineConfig(() => {
  const API_TARGET = "http://localhost:5000";

  return {
    server: {
      host: "::",
      port: 8080,
      proxy: {
        "/api": apiProxy(API_TARGET),
      },
    },
    plugins: [react(), requestLoggerPlugin(API_TARGET), buildShaPlugin(), routePreloadPlugin(), siteThemePlugin()],
    /*
     * Four vendor chunks, so a change to the site does not re-download React.
     *
     * There was no `build` block at all, which meant everything that is not
     * behind a lazy route — react, react-dom, react-router, react-query, four
     * Radix packages, sonner, lucide and zod — shipped inside the entry chunk
     * with the app. Measured at 527,287 raw / 161,854 gzip, against the
     * 410kB this was filed at: every copy edit invalidated the whole thing
     * for every returning visitor.
     *
     * The split is by rate of change, not by size. The framework moves a few
     * times a year, the data layer less often than that, the interface
     * primitives rarely, and the app moves every time anything is written —
     * so each gets its own file and a returning reader re-fetches only the
     * last one. Splitting any finer would trade cache hits for requests;
     * these four are the boundaries that actually exist.
     *
     * Shiki and its grammars are already out of here behind the lazy post
     * route (1.45MB raw across 24 languages) and stay there.
     *
     * A package named here is preloaded by every route that imports any part
     * of the chunk, so a list may only hold what the entry itself renders
     * (#126). `ui` is the Radix the nav draws on every public page — the
     * language menu, the tooltips, the Slot under Button — and nothing else.
     * sonner and lucide-react used to be in it too: sonner is raised only by
     * the post's reading bar, so it now lands in that route's chunk, and
     * lucide is per-icon ESM that Rollup already splits by importer. Naming
     * them here dragged both onto `/`, `/blog` and `/projects`, which render
     * neither. Do not add a package to a list without checking it is used
     * above `<Routes>` or in the chrome.
     *
     * Vite 8 bundles with Rolldown, which has no object form of
     * `manualChunks`; the same four groups are `codeSplitting` groups matched
     * on the package directory. `react-router` is named beside
     * `react-router-dom` because v7 moved the code into it and left `-dom` a
     * re-export.
     */
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              { name: "react", test: pkg("react", "react-dom", "scheduler", "react-router", "react-router-dom") },
              { name: "query", test: pkg("@tanstack/react-query", "@tanstack/query-core") },
              { name: "ui", test: pkg("@radix-ui/react-dropdown-menu", "@radix-ui/react-slot", "@radix-ui/react-tooltip") },
              { name: "schema", test: pkg("zod") },
            ],
          },
        },
      },
    },
    resolve: {
      alias: { "@": path.resolve(import.meta.dirname, "./src") },
    },
  };
});
