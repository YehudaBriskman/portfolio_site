import { readFileSync } from "node:fs";

/** A stylesheet with comments removed. */
export function readCss(path: string): string {
  return readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * The stylesheet with every `@media (prefers-reduced-motion: no-preference)`
 * block (nested braces and all) cut out: what is left is what a reader who
 * asked for reduced motion gets, so it must hold no transition, animation or
 * keyframes.
 */
export function outsideNoPreference(css: string): string {
  const marker = "@media (prefers-reduced-motion: no-preference)";
  let out = css;
  for (let at = out.indexOf(marker); at !== -1; at = out.indexOf(marker)) {
    let i = out.indexOf("{", at);
    let depth = 1;
    i++;
    while (depth > 0 && i < out.length) {
      if (out[i] === "{") depth++;
      else if (out[i] === "}") depth--;
      i++;
    }
    out = out.slice(0, at) + out.slice(i);
  }
  return out;
}
