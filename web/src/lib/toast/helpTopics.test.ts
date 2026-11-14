import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { HELP_TOPICS, helpHref, type HelpTopic } from "./helpTopics";

const SRC = resolve(__dirname, "../..");
const help = readFileSync(resolve(SRC, "pages/Help.tsx"), "utf8");
const registry = readFileSync(resolve(SRC, "lib/help/topics.ts"), "utf8");
const guide = readFileSync(resolve(SRC, "../../docs/admin-design-guide.md"), "utf8");

describe("toast help topics", () => {
  const topics = Object.entries(HELP_TOPICS) as [HelpTopic, "public" | "admin"][];

  it.each(topics.filter(([, s]) => s === "public"))("%s has a section on /help", (topic) => {
    /* A section is either written in Help.tsx or generated from the /help registry (lib/help/topics.ts). */
    expect(help + registry, `add <h2 id="${topic}"> to pages/Help.tsx first`).toMatch(new RegExp(`id=["']${topic}["']|"${topic}":`));
  });

  it.each(topics.filter(([, s]) => s === "admin"))("%s has a heading in the admin guide", (topic) => {
    const slugs = [...guide.matchAll(/^#{2,4}\s+(.+)$/gm)].map((m) =>
      m[1].toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-"),
    );
    expect(slugs).toContain(topic);
  });

  it("links public topics to /help#id", () => {
    expect(helpHref("sharing")).toBe("/help#sharing");
  });
});
