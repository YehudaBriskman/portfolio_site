import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { HELP_TOPICS, helpHref, type HelpTopic } from "./helpTopics";

const SRC = resolve(__dirname, "../..");
const pages = readFileSync(resolve(SRC, "lib/help/pages.ts"), "utf8");
const registry = readFileSync(resolve(SRC, "lib/help/topics.ts"), "utf8");
const guide = readFileSync(resolve(SRC, "../../docs/admin-design-guide.md"), "utf8");

describe("toast help topics", () => {
  const topics = Object.entries(HELP_TOPICS) as [HelpTopic, "public" | "admin"][];

  it.each(topics.filter(([, s]) => s === "public"))("%s has a page at /help/<id>", (topic) => {
    /* A page is a guide (lib/help/pages.ts) or an outcome topic (lib/help/topics.ts). */
    expect(pages + registry, `add "${topic}" to lib/help/pages.ts or topics.ts first`).toMatch(new RegExp(`"${topic}"`));
  });

  it.each(topics.filter(([, s]) => s === "admin"))("%s has a heading in the admin guide", (topic) => {
    const slugs = [...guide.matchAll(/^#{2,4}\s+(.+)$/gm)].map((m) =>
      m[1].toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-"),
    );
    expect(slugs).toContain(topic);
  });

  it("links public topics to /help/id", () => {
    expect(helpHref("sharing")).toBe("/help/sharing");
  });
});
