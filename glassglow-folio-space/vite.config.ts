// vite.config.ts
import { defineConfig, loadEnv, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

function color(code: number) {
  return (s: string) => `\x1b[${code}m${s}\x1b[0m`;
}
const grey = color(90);
const green = color(32);
const yellow = color(33);
const red = color(31);
const cyan = color(36);
const magenta = color(35);

type ReqLike = { method?: string; url?: string; __reqId?: number };
type ResLike = { statusCode?: number; on?: any };

function makeIdGen() {
  let n = 0;
  return () => {
    n = (n + 1) % Number.MAX_SAFE_INTEGER;
    return n || 1;
  };
}
const nextId = makeIdGen();

function startClock() {
  const t0 = Date.now();
  return () => Date.now() - t0;
}

function fmtUrl(target: string | undefined, path: string | undefined) {
  if (!path) return "/";
  if (!target) return path;
  const base = target.replace(/\/+$/, "");
  const rel = path.startsWith("/") ? path : `/${path}`;
  return `${base}${rel}`;
}

function statusColor(status?: number) {
  if (!status) return grey;
  if (status >= 500) return red;
  if (status >= 400) return yellow;
  return green;
}

/** ---------- Proxy logger factory ---------- */
function proxyWithLogs(target: string) {
  return {
    target,
    changeOrigin: true,
    ws: true,
    configure: (proxy: any) => {
      proxy.on("proxyReq", (proxyReq: any, req: ReqLike) => {
        req.__reqId = req.__reqId || nextId();
        const id = req.__reqId;
        const line =
          `${grey(`[${id}]`)} ${cyan("→ outgoing")} ` +
          `${(req.method || "GET").toUpperCase()} ${fmtUrl(target, req.url)}`;
        (console as any).log(line);
        // clock starts
        (req as any).__dur = startClock();
      });

      proxy.on("proxyRes", (proxyRes: any, req: ReqLike) => {
        const id = req.__reqId || nextId();
        const dur = (req as any).__dur ? (req as any).__dur() : 0;
        const sc = statusColor(proxyRes?.statusCode);
        const line =
          `${grey(`[${id}]`)} ${sc("← incoming")} ` +
          `${(req.method || "GET").toUpperCase()} ${fmtUrl(target, req.url)} ` +
          `${sc(String(proxyRes?.statusCode ?? "-"))} ${grey(`${dur}ms`)}`;
        (console as any).log(line);
      });

      proxy.on("error", (err: any, req: ReqLike) => {
        const id = req.__reqId || nextId();
        const dur = (req as any).__dur ? (req as any).__dur() : 0;
        (console as any).error(
          `${grey(`[${id}]`)} ${red("✖ proxy error")} ${(req.method || "GET").toUpperCase()} ${fmtUrl(target, req.url)} ${grey(`${dur}ms`)}`,
          "\n",
          err?.message || err
        );
      });
    },
  };
}

/** ---------- Static (frontend) requests logger as a Vite plugin ---------- */
function requestLoggerPlugin(): Plugin {
  return {
    name: "request-logger",
    configureServer(server) {
      server.middlewares.use((req: ReqLike, res: ResLike, next) => {
        // assign id once
        req.__reqId = req.__reqId || nextId();
        const id = req.__reqId;
        const method = (req.method || "GET").toUpperCase();
        const url = req.url || "/";
        const clock = startClock();

        // Mark reception of ANY request reaching Vite dev server
        (console as any).log(
          `${grey(`[${id}]`)} ${magenta("→ received")} ${method} ${url}`
        );

        res.on("finish", () => {
          const dur = clock();
          const sc = statusColor(res.statusCode);
          (console as any).log(
            `${grey(`[${id}]`)} ${sc("← responded")} ${method} ${url} ${sc(String(res.statusCode ?? "-"))} ${grey(`${dur}ms`)}`
          );
        });

        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const API_TARGET = env.VITE_API_TARGET || "http://localhost:5000";

  return {
    server: {
      host: "::",
      port: 8080,
      proxy: {
        "/api": proxyWithLogs(API_TARGET),
        // add more routes if needed:
        // "/files": proxyWithLogs(env.VITE_FILES_TARGET || "http://localhost:7003"),
      },
    },
    plugins: [
      react(),
      requestLoggerPlugin(), // logs every request hitting Vite (HTML, JS, CSS, images, HMR, etc.)
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
