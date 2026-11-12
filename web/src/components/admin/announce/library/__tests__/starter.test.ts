import { describe, expect, it } from "vitest";
import { z } from "zod";
import { planStarter, STARTER_SNIPPETS, STARTER_TEMPLATES } from "../starter";

/* The backend limits (backend/src/announce/schemas.ts), replicated by hand: web cannot import the backend. */
const Id = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const Name = z.string().trim().min(1).max(60);
const Template = z.object({ id: Id, name: Name, channel: z.enum(["linkedin", "instagram", "email", "gmail", "x"]), lang: z.enum(["en", "he"]), text: z.string().max(2000) }).strict();
const Snippet = z.object({ id: Id, name: Name, kind: z.enum(["hashtags", "signature", "cta", "links"]), text: z.string().max(1000) }).strict();

describe("starter pack", () => {
  it("passes the backend limits", () => {
    expect(z.array(Template).max(100).safeParse(STARTER_TEMPLATES).success).toBe(true);
    expect(z.array(Snippet).max(50).safeParse(STARTER_SNIPPETS).success).toBe(true);
  });
  it("has unique ids, no default, and no markup", () => {
    const all = [...STARTER_TEMPLATES, ...STARTER_SNIPPETS];
    expect(new Set(all.map((x) => x.id)).size).toBe(all.length);
    for (const t of STARTER_TEMPLATES) expect("default" in t).toBe(false);
    for (const x of all) expect(`${x.name}\n${x.text}`).not.toMatch(/<[^>]*>|&\w+;|&#/);
  });
  it("merges non-destructively and skips what exists", () => {
    const first = planStarter([], []);
    expect(first.added).toBe(STARTER_TEMPLATES.length + STARTER_SNIPPETS.length);
    const mine = [{ ...STARTER_TEMPLATES[0], text: "mine" }, { id: "x", name: STARTER_TEMPLATES[1].name, channel: STARTER_TEMPLATES[1].channel, lang: STARTER_TEMPLATES[1].lang, text: "y" }];
    const p = planStarter(mine, []);
    expect(p.skipped).toBe(2);
    expect(p.templates.map((t) => t.id)).not.toContain(STARTER_TEMPLATES[0].id);
    expect(planStarter([...mine, ...p.templates], [...p.snippets]).added).toBe(0);
  });
  it("respects the template limit", () => {
    const full = Array.from({ length: 99 }, (_, i) => ({ id: `u${i}`, name: `n${i}`, channel: "x" as const, lang: "en" as const, text: "" }));
    expect(planStarter(full, []).templates).toHaveLength(1);
  });
});
