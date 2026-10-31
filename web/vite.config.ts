// vite.config.ts
import { defineConfig, type Plugin, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import type { IncomingMessage, ServerResponse } from "http";

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
    plugins: [react(), requestLoggerPlugin(API_TARGET)],
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
     */
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom", "react-router-dom"],
            query: ["@tanstack/react-query"],
            ui: [
              "@radix-ui/react-dropdown-menu",
              "@radix-ui/react-slot",
              "@radix-ui/react-toast",
              "@radix-ui/react-tooltip",
              "sonner",
              "lucide-react",
            ],
            schema: ["zod"],
          },
        },
      },
    },
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
    },
  };
});
