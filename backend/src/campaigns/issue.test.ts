import { beforeEach, describe, expect, it, vi } from "vitest";
import { couch, CouchError } from "../db/couch.js";
import { env } from "../env.js";
import { DEFAULT_ANNOUNCE_SETTINGS, type AnnounceEvent } from "../announce/schemas.js";
import { releaseNotes } from "../services/github.js";
import { leadOf } from "../announce/hooks.js";
import { blocksFor } from "./body.js";
import { buildIssue, clip, compileIssue, maybeAutoCompile, projectOf, windowStart } from "./issue.js";
import { campaignLabel, renderCampaignMail } from "./render.js";
import { CampaignCreate, type Campaign } from "./schemas.js";

const SITE = new URL(env.SITE_URL).origin;
const S = DEFAULT_ANNOUNCE_SETTINGS;
const NOW = new Date("2026-12-01T09:00:00Z");
const SINCE = new Date("2026-11-01T00:00:00Z");

const ev = (o: Partial<AnnounceEvent> & Pick<AnnounceEvent, "kind" | "ref" | "title">): AnnounceEvent => ({
  _id: `announce:${o.kind}:${o.ref}`, type: "announce", summary: `About ${o.title}`, tags: [], url: o.kind === "release" ? `https://github.com/o/r/releases/tag/${o.ref}` : `${SITE}/blog/${o.ref}`,
  ...(o.kind === "post" ? { path: `/blog/${o.ref}` } : {}), langs: ["en"], createdAt: "2026-11-10T00:00:00Z", done: {}, ...o,
});
const rel = (project: string, v: string, at: string, notes?: string[]) => ev({ kind: "release", ref: v, title: `${project} ${v}`, version: v, publishedAt: at, createdAt: at, ...(notes ? { notes } : {}) });
const post = (ref: string, at: string, tags: string[], o: Partial<AnnounceEvent> = {}) => ev({ kind: "post", ref, title: `Post ${ref}`, publishedAt: at, createdAt: at, tags, readMinutes: 5, ...o });

/* The owner's scenario: 2 WindoM releases, 1 Bothy release, 5 posts (3 on one topic), 1 patch release. */
const scenario: AnnounceEvent[] = [
  rel("WindoM", "v1.2.0", "2026-11-05T10:00:00Z", ["Faster tiling", "New shortcuts"]),
  rel("WindoM", "v1.3.0", "2026-11-20T10:00:00Z", ["Multi-monitor"]),
  rel("Bothy", "v0.5.0", "2026-11-12T10:00:00Z"),
  rel("WindoM", "v1.3.1", "2026-11-22T10:00:00Z"),
  post("a", "2026-11-03T08:00:00Z", ["Email"]),
  post("b", "2026-11-08T08:00:00Z", ["email"]),
  post("c", "2026-11-25T08:00:00Z", ["Email"], { titleHe: "פוסט ג", summaryHe: "תקציר", lead: "x".repeat(900) }),
  post("d", "2026-11-15T08:00:00Z", ["Design"]),
  post("e", "2026-11-18T08:00:00Z", []),
];
const issue = () => buildIssue(scenario, S, NOW, SINCE)!;
const texts = (blocks: ReturnType<typeof issue>["blocks"]) => blocks.map((b) => b.text ?? "");

describe("the window", () => {
  const sentIssue = (until: string): Campaign => ({ _id: "campaign:i1", type: "campaign", name: "n", subject: "s", bodyText: "", groups: [], kind: "issue", status: "sent", compiledUntil: until, counters: { queued: 0, sent: 0, failed: 0, suppressed: 0 }, createdAt: until, updatedAt: until });
  it("starts at the last SENT issue's compiledUntil", () => {
    expect(windowStart([sentIssue("2026-10-01T00:00:00Z"), sentIssue("2026-11-01T00:00:00Z")], S.sender.issue, NOW).toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });
  it("ignores drafts and other kinds, then falls back to windowDays", () => {
    const draft = { ...sentIssue("2026-11-30T00:00:00Z"), status: "draft" as const };
    const plain = { ...sentIssue("2026-11-30T00:00:00Z"), kind: undefined };
    expect(windowStart([draft, plain], S.sender.issue, NOW).toISOString()).toBe("2026-11-01T09:00:00.000Z");
  });
  it("an explicit start wins", () => {
    expect(windowStart([sentIssue("2026-11-01T00:00:00Z")], S.sender.issue, NOW, "2026-11-10T00:00:00Z").toISOString()).toBe("2026-11-10T00:00:00.000Z");
  });
  it("only events inside the window count", () => {
    const i = buildIssue(scenario, S, NOW, new Date("2026-11-21T00:00:00Z"))!;
    expect(i.notes).toBe(1);
    expect(i.releases).toBe(1);
  });
});

describe("an empty window", () => {
  it("makes no issue", () => {
    expect(buildIssue([], S, NOW, SINCE)).toBeNull();
    expect(buildIssue(scenario, S, NOW, new Date("2026-11-30T00:00:00Z"))).toBeNull();
    expect(buildIssue([{ ...post("z", "2026-11-10T00:00:00Z", []), dismissed: "2026-11-11T00:00:00Z" }], S, NOW, SINCE)).toBeNull();
  });
});

describe("grouping and order", () => {
  it("groups releases by project under 'New on {name}', versions inside, newest section first", () => {
    const t = texts(issue().blocks);
    expect(t).toContain("New on WindoM");
    expect(t).toContain("New on Bothy");
    expect(t.filter((x) => x === "New on WindoM")).toHaveLength(1);
    const w = t.indexOf("New on WindoM");
    expect(t.slice(w).indexOf("v1.3.0")).toBeLessThan(t.slice(w).indexOf("v1.2.0"));
    expect(t).toContain("Faster tiling".length ? "What changed" : "");
  });
  it("groups posts by topic (first tag, any case), under the topic name", () => {
    const t = texts(issue().blocks);
    expect(t.filter((x) => x === "Email")).toHaveLength(1);
    expect(t).toContain("Design");
    expect(t).toContain("Latest notes");
    const email = t.indexOf("Email");
    const after = t.slice(email, email + 40);
    for (const title of ["Post a", "Post b", "Post c"]) expect(after).toContain(title);
  });
  it("dots between two items of one group, a rule between sections, never at the ends", () => {
    const b = issue().blocks;
    const types = b.map((x) => x.type);
    expect(types.filter((x) => x === "dot").length).toBe(3 /* WindoM 1 + Email 2 */);
    expect(types).toContain("rule");
    expect(types[0]).not.toBe("rule");
    expect(types.at(-1)).not.toBe("rule");
    b.forEach((x, i) => {
      if (x.type === "dot") expect(["p", "ul", "cta"]).toContain(b[i - 1]?.type), expect(["p", "ul", "cta"]).toContain(b[i + 1]?.type);
    });
  });
  it("the lead item alone has the cover, a solid button; the rest are outlined", () => {
    const b = issue().blocks;
    for (const l of ["en", "he"] as const) expect(blocksFor(b, l).filter((x) => x.type === "image")).toHaveLength(1);
    const ctas = b.filter((x) => x.type === "cta");
    /* The lead has an English and a Hebrew button; every other item's is outlined. */
    expect(ctas.filter((x) => !x.outline)).toHaveLength(2);
    expect(ctas.every((x) => x.label === "Read more" || x.lang === "he")).toBe(true);
  });
  it("caps a section at maxPerSection", () => {
    const many = Array.from({ length: 9 }, (_, i) => post(`m${i}`, `2026-11-${10 + i}T00:00:00Z`, ["Email"]));
    const cfg = { ...S, sender: { ...S.sender, issue: { ...S.sender.issue, maxPerSection: 3 } } };
    expect(texts(buildIssue(many, cfg, NOW, SINCE)!.blocks.filter((x) => x.type === "p")).filter((x) => /^Post m/.test(x))).toHaveLength(3);
  });
});

describe("patch releases", () => {
  it("are one 'Also shipped' line, not a card", () => {
    const t = texts(issue().blocks);
    expect(t).toContain("Also shipped: WindoM v1.3.1");
    expect(t.filter((x) => x === "v1.3.1")).toHaveLength(0);
  });
  it("become cards when the rule is off", () => {
    const cfg = { ...S, sender: { ...S.sender, issue: { ...S.sender.issue, patchLine: false } } };
    expect(texts(buildIssue(scenario, cfg, NOW, SINCE)!.blocks)).toContain("v1.3.1");
  });
  it("only patches: still an issue, no cover", () => {
    const i = buildIssue([rel("WindoM", "v1.3.1", "2026-11-22T10:00:00Z")], S, NOW, SINCE)!;
    expect(i.blocks.some((b) => b.type === "image")).toBe(false);
    expect(texts(i.blocks)).toContain("Also shipped: WindoM v1.3.1");
  });
});

describe("what an item says", () => {
  it("title, date, read time, a longer summary (the lead text, clipped), release notes, a link", () => {
    const b = issue().blocks;
    const t = texts(b);
    expect(t).toContain("November 3, 2026 · 5 min");
    expect(t).toContain("Faster tiling".slice(0, 0) + "What changed");
    const ul = b.find((x) => x.type === "ul" && x.items?.includes("Faster tiling"));
    expect(ul?.items).toEqual(["Faster tiling", "New shortcuts"]);
    const long = b.find((x) => x.type === "p" && x.text?.startsWith("xxx"));
    expect(long?.text?.length).toBeLessThanOrEqual(300);
    expect(long?.text?.endsWith("…")).toBe(true);
  });
  it("a post with a translation has an English and a Hebrew copy, each tagged; one without has none", () => {
    const b = issue().blocks;
    expect(b.filter((x) => x.type === "p" && x.lang === "he" && x.text === "פוסט ג")).toHaveLength(1);
    expect(b.find((x) => x.type === "p" && x.text === "Post c")?.lang).toBe("en");
    expect(b.find((x) => x.type === "p" && x.text === "Post a")?.lang).toBeUndefined();
    const forHe = blocksFor(b, "he").map((x) => x.text);
    expect(forHe).toContain("פוסט ג");
    expect(forHe).not.toContain("Post c");
    expect(forHe).toContain("Post a");
    expect(blocksFor(b, "en").map((x) => x.text)).not.toContain("פוסט ג");
  });
  it("the subject counts what happened since the date, and the draft passes the schema the editor saves with", () => {
    const i = issue();
    expect(i.subject).toBe("5 notes and 4 releases since November 1, 2026");
    expect(CampaignCreate.safeParse({ name: i.name, subject: i.subject, bodyText: i.bodyText, blocks: i.blocks, groups: ["subscribers"] }).success).toBe(true);
    expect(i.bodyText).toContain("Read more: ");
  });
  it("helpers", () => {
    expect(projectOf(rel("WindoM", "v1.2.0", "x"))).toBe("WindoM");
    expect(clip("one two three four", 9)).toBe("one two…");
    expect(leadOf("# T\n\nFirst **para** with [a link](https://x.test).\n\n- list\n\nSecond para.\n\nThird.")).toBe("First para with a link.\n\nSecond para.");
    expect(releaseNotes("* Alpha thing\n* Beta thing")).toEqual(["Alpha thing", "Beta thing"]);
  });
});

describe("the mail an issue makes", () => {
  beforeEach(() => {
    (env as { SUBSCRIBE_SECRET?: string }).SUBSCRIBE_SECRET = "s".repeat(32);
    vi.spyOn(couch, "get").mockImplementation(async () => {
      throw new CouchError(404, "404");
    });
  });
  const sender = { ...S.sender, footerIdentity: "Yehuda", identityEmail: "me@example.org", identityWebsite: "https://example.org" };
  const mail = async (lang: "en" | "he", extra: { labelAd?: boolean } = {}, s = sender) => {
    const i = issue();
    return renderCampaignMail({ subject: i.subject, bodyText: i.bodyText, blocks: i.blocks, ...extra }, { lang }, "h".repeat(32), s);
  };

  it("has no label by default, and the toggle brings the label and subject prefix back", async () => {
    const plain = await mail("he", { labelAd: false }, { ...sender, labelMode: "hebrew" });
    expect(plain.subject).not.toContain("פרסומת");
    expect(plain.text).not.toContain("פרסומת");
    const on = await mail("he", { labelAd: true });
    expect(on.subject.startsWith("פרסומת: ")).toBe(true);
    expect(on.text.startsWith("פרסומת")).toBe(true);
    const onEn = await mail("en", { labelAd: true });
    expect(onEn.subject.startsWith("פרסומת | Ad: ")).toBe(true);
  });
  it("a campaign saved before the toggle still follows the sender's policy", async () => {
    expect(campaignLabel({}, "hebrew", "he")?.subject).toBe("פרסומת");
    expect(campaignLabel({}, "off", "he")).toBeNull();
    expect(campaignLabel({ labelAd: false }, "all", "he")).toBeNull();
    expect(CampaignCreate.parse({ name: "n", subject: "s", bodyText: "", blocks: null, groups: ["subscribers"] }).labelAd).toBe(false);
  });
  it("keeps the legal frame: both headers, one-click, a visible unsubscribe button, the approved sentence", async () => {
    for (const lang of ["en", "he"] as const) {
      const m = await mail(lang);
      expect(m.headers["List-Unsubscribe"]).toMatch(/^<https?:\/\/[^>]+\/api\/subscribe\/unsubscribe\?token=/);
      expect(m.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
      expect(m.headers.Precedence).toBe("bulk");
      expect(m.html).toMatch(/<a class="oba" href="[^"]*\/unsubscribe\?token=[^"]+"[^>]*>(Unsubscribe|הסרה מהרשימה)</);
      expect(m.html).toContain((lang === "he" ? sender.unsubscribeNoteHe : sender.unsubscribeNoteEn).split(" {site}")[0]);
      expect(m.text).toMatch(/https?:\/\/\S+\/unsubscribe\?token=\S+/);
    }
  });
  it("every link is a button and no raw address is printed in the HTML; the text twin keeps full URLs", async () => {
    for (const lang of ["en", "he"] as const) {
      const m = await mail(lang);
      const visible = m.html.split(/<style\b/).map((part, i) => (i === 0 ? part : part.slice(part.indexOf("</style>") + 8))).join(" ").replace(/<[^>]+>/g, " ").replace(/[<>]/g, " ");
      expect(visible).not.toMatch(/https?:\/\//);
      expect(visible).not.toMatch(/\btoken=/);
      const anchors = [...m.html.matchAll(/<a\b[^>]*>/g)].map((a) => a[0]);
      expect(anchors.length).toBeGreaterThan(5);
      for (const a of anchors) expect(a).toMatch(/class="(oba|btna)"/);
      expect(m.text).toContain("Read more: ");
    }
  });
  it("is clean of tracking, scripts, flex and grid; images carry alt and width; one image only", async () => {
    const { html } = await mail("en");
    const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((x) => x[0]);
    expect(imgs).toHaveLength(1);
    expect(imgs[0]).toMatch(/alt="[^"]+"/);
    expect(imgs[0]).toMatch(/width="\d+"/);
    for (const m of html.matchAll(/href="([^"]+)"/g)) expect(m[1]).not.toMatch(/utm_|[?&](track|click|open|redirect)=|\/(track|click|redirect)\//i);
    expect(html).not.toMatch(/<script|display:\s*(flex|grid)|<form|<link\b/i);
  });
  it("Hebrew recipient: rtl, Hebrew copy of the translated post, English for the rest", async () => {
    const m = await mail("he");
    expect(m.html).toMatch(/<html lang="he" dir="rtl"/);
    expect(m.text).toContain("פוסט ג");
    expect(m.text).not.toContain("Post c");
    expect(m.text).toContain("Post a");
  });
  it("text twin snapshot (English)", async () => {
    const { text } = await mail("en");
    expect(text.replace(/token=[\w.-]+/g, "token=T")).toMatchSnapshot();
  });
});

describe("compile and auto-compile (stored as drafts only)", () => {
  let store: Map<string, Record<string, unknown>>;
  beforeEach(() => {
    store = new Map();
    vi.spyOn(couch, "get").mockImplementation(async <R>(id: string) => {
      const d = store.get(id);
      if (!d) throw new CouchError(404, "404");
      return structuredClone(d) as R;
    });
    vi.spyOn(couch, "append").mockImplementation(async <R>(id: string, body: Record<string, unknown>) => {
      store.set(id, structuredClone(body));
      return { ok: true, id } as R;
    });
    vi.spyOn(couch, "find").mockImplementation(async (q: unknown) => {
      const { selector } = q as { selector: { _id: { $gt: string } } };
      const prefix = selector._id.$gt;
      return { docs: [...store.entries()].filter(([k]) => k.startsWith(prefix)).map(([, v]) => structuredClone(v)) } as never;
    });
  });
  const seed = () => scenario.forEach((e) => store.set(`announce:${e.kind}:${e.ref}`, { ...e, _id: `announce:${e.kind}:${e.ref}` }));

  it("nothing new: no draft", async () => {
    expect(await compileIssue(NOW)).toBeNull();
    expect([...store.keys()]).toEqual([]);
  });
  it("makes one DRAFT issue for the subscribers group, never scheduled, labelAd off, window end recorded", async () => {
    seed();
    const c = await compileIssue(NOW, { since: SINCE.toISOString() });
    expect(c).toMatchObject({ kind: "issue", status: "draft", groups: ["subscribers"], labelAd: false, compiledUntil: NOW.toISOString(), lang: "all" });
    expect(c?.sendAt).toBeUndefined();
    expect([...store.keys()].filter((k) => k.startsWith("campaign:"))).toHaveLength(1);
  });
  it("auto-compile is off by default, and when on waits for the period and for the owner to clear a held draft", async () => {
    seed();
    const on = (m: "weekly" | "monthly") => ({ ...S, sender: { ...S.sender, issue: { ...S.sender.issue, autoCompile: m } } });
    expect(await maybeAutoCompile(S, NOW)).toBeNull();
    expect(await maybeAutoCompile(on("weekly"), NOW)).not.toBeNull();
    expect(await maybeAutoCompile(on("weekly"), new Date("2026-12-02T00:00:00Z"))).toBeNull();
  });
});
