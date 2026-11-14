import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * One toast service. Sonner is the renderer and only `ToastHost` talks to it;
 * everything else raises a toast through `@/lib/toast`, so id-dedupe, the
 * duration rules, the history and the modal-safe mount cannot be bypassed.
 * Also: a hand-made `position: fixed` toast strip is how UndoToast started.
 */

const SRC = resolve(__dirname, "../..");

function files(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) files(p, out);
    else if (/\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n)) out.push(p);
  }
  return out;
}

describe("toast guard", () => {
  it("only ToastHost imports sonner", () => {
    const offenders = files(SRC)
      .filter((f) => /from\s+["']sonner["']/.test(readFileSync(f, "utf8")))
      .map((f) => relative(SRC, f));
    expect(offenders, "raise toasts with @/lib/toast; sonner is ToastHost's alone").toEqual(["components/ui/ToastHost.tsx"]);
  });

  it("the toast host is mounted once, from App", () => {
    const mounts = files(SRC)
      .filter((f) => /<ToastHost\b|<ToastMount\b/.test(readFileSync(f, "utf8")))
      .map((f) => relative(SRC, f));
    expect(mounts.filter((m) => m !== "components/ui/ToastMount.tsx")).toEqual(["App.tsx"]);
  });
});
