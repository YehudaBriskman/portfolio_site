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
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
    },

    // Aggressive build optimization for performance
    build: {
      target: 'es2020',
      minify: 'terser',
      rollupOptions: {
        output: {
          // Manual chunk splitting for better caching
          manualChunks: {
            // Core React libraries
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            // UI component libraries
            'ui-vendor': [
              '@radix-ui/react-dialog',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-popover',
              '@radix-ui/react-select',
              '@radix-ui/react-tabs',
              '@radix-ui/react-toast',
              '@radix-ui/react-label',
              '@radix-ui/react-slot',
              '@radix-ui/react-tooltip',
            ],
            // Form handling
            'form-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],
            // Animation library
            'animation-vendor': ['framer-motion'],
            // Data fetching
            'query-vendor': ['@tanstack/react-query'],
          },
          // Optimize chunk naming for better caching
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        },
      },
      // Warn on chunks larger than 500KB
      chunkSizeWarningLimit: 500,
    },

    // CSS optimization
    css: {
      devSourcemap: false,
    },
  };
});
