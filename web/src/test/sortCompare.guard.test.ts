import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/* #827: a sort says how it compares, in the files where one did not. */
const FILES = ["src/components/admin/announce/campaigns/CampaignEditor.tsx", "src/pages/AdminEditor.tsx"];

describe("sort calls", () => {
  it.each(FILES)("%s passes a compare function", (file) => {
    expect(readFileSync(resolve(__dirname, "../..", file), "utf8")).not.toMatch(/\.(sort|toSorted)\(\s*\)/);
  });
});
