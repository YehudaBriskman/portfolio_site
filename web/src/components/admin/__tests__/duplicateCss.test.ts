import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

/* #829: a property declared twice in one rule, in the two sheets where it was
   found. (Not repo-wide: `100vh` then `100dvh` is a fallback, on purpose.) */
const FILES = ["src/components/admin/announce/inbox/inbox.css", "src/components/admin/phone/phone.module.css"];

describe("duplicate CSS properties", () => {
  it.each(FILES)("%s declares each property once per rule", (file) => {
    const twice: string[] = [];
    postcss.parse(readFileSync(resolve(__dirname, "../../../..", file), "utf8")).walkRules((rule) => {
      const seen = new Set<string>();
      rule.each((node) => {
        if (node.type !== "decl") return;
        if (seen.has(node.prop)) twice.push(`${rule.selector} { ${node.prop} }`);
        seen.add(node.prop);
      });
    });
    expect(twice).toEqual([]);
  });
});
