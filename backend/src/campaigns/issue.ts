import { randomBytes } from "node:crypto";
import { cardUrl } from "../announce/emailHtml.js";
import type { AnnounceEvent, AnnounceSettings, IssueSettings } from "../announce/schemas.js";
import { listEvents, loadSettings } from "../announce/store.js";
import { SYSTEM_GROUP } from "../audience/schemas.js";
import { SITE_URL, absoluteUrl, pathIn } from "../services/seo.js";
import { safeHref } from "./body.js";
import type { Block, Campaign, Topic } from "./schemas.js";
import { campaignId, createCampaign, listCampaigns } from "./store.js";

/*
 * The issue engine: one newsletter issue compiled from what happened since the
 * last issue was sent. It makes a DRAFT campaign out of ordinary blocks, so the
 * owner can reorder, edit or delete anything in the editor; sending still goes
 * through the existing test-send, confirm-count and schedule flow. Nothing here
 * sends, schedules or reads an address.
 *
 * Rules (editable in settings, `sender.issue`):
 *  - window: from the last sent issue's `compiledUntil`, else `windowDays` back
 *  - releases are grouped by project under "New on {name}", posts by topic (the
 *    first tag); inside a group items are separated by a dot, between groups a rule
 *  - patch releases (x.y.Z, Z above 0) are one "Also shipped" line, not cards
 *  - only the lead (newest) item carries the cover image
 *  - each item: title, date and read time, a longer summary, a "Read more" button
 *  - nothing new: no draft
 *  - every block of an item carries its topic (releases are `releases`, posts and
 *    new projects are `blog`), so each person gets only theirs (topics.ts)
 */
export const PATCH_RELEASE = /^v?\d+\.\d+\.[1-9]\d*$/;
const DAY = 86_400_000;

type Lang = "en" | "he";
type Item = { ev: AnnounceEvent; at: string };
type Section = { newest: string; heading: Block[]; items: Item[]; render: (it: Item, lead: boolean) => Block[] };

export type Issue = { blocks: Block[]; bodyText: string; subject: string; name: string; preheader: string; topicLines: NonNullable<Campaign["topicLines"]>; notes: number; releases: number; since: string; until: string };

const day = (iso: string, lang: Lang) => new Intl.DateTimeFormat(lang === "he" ? "he-IL" : "en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(iso));
const hasHe = (ev: AnnounceEvent) => Boolean(ev.titleHe || ev.summaryHe);
const tag = (l: Lang | null): { lang?: Lang } => (l ? { lang: l } : {});
const topicOf = (ev: AnnounceEvent): Topic => (ev.kind === "release" ? "releases" : "blog");
const scoped = (topic: Topic, blocks: Block[]): Block[] => blocks.map((b) => ({ ...b, topic }));

/** At most `max` characters, cut at a word boundary, with an ellipsis when cut. */
export function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), Math.floor(max / 2))).trimEnd()}…`;
}

/** The project a release event is about: its title without the trailing tag ("WindoM v1.2.0" is WindoM). */
export function projectOf(ev: AnnounceEvent): string {
  const t = ev.ref && ev.title.endsWith(ev.ref) ? ev.title.slice(0, -ev.ref.length).trim() : ev.title;
  return t || ev.title;
}

/** Where an issue starts: an explicit date, else the end of the last sent issue, else `windowDays` back. */
export function windowStart(campaigns: Campaign[], issue: Pick<IssueSettings, "windowDays">, now: Date, explicit?: string): Date {
  if (explicit && !Number.isNaN(Date.parse(explicit))) return new Date(explicit);
  const sent = campaigns
    .filter((c) => c.kind === "issue" && (c.status === "sent" || c.status === "sending"))
    .map((c) => c.compiledUntil ?? c.finishedAt ?? c.startedAt ?? c.createdAt)
    .sort();
  const last = sent[sent.length - 1];
  return last ? new Date(last) : new Date(now.getTime() - issue.windowDays * DAY);
}

const urlFor = (ev: AnnounceEvent, lang: Lang) => (ev.path ? absoluteUrl(pathIn(ev.path, lang)) : ev.url);

/** The plain-text twin of the blocks, the same lines the mail's text part says. */
export function blocksText(blocks: Block[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case "ul":
          return (b.items ?? []).map((i) => `- ${i}`).join("\n");
        case "facts":
          return (b.rows ?? []).map((r) => `${r.label}: ${r.value}`).join("\n");
        case "cta":
          return `${b.label}: ${b.url}`;
        case "dot":
          return "·";
        case "rule":
          return "--";
        case "image":
          return "";
        default:
          return b.text ?? "";
      }
    })
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Pure: the issue for these events, or null when there is nothing to say.
 * `events` need not be filtered; the window is applied here.
 */
export function buildIssue(events: AnnounceEvent[], settings: AnnounceSettings, now: Date, since: Date): Issue | null {
  const cfg = settings.sender.issue;
  const inWindow = events
    .filter((e) => !e.dismissed && (e.kind === "post" || e.kind === "release" || e.kind === "project"))
    .map((ev) => ({ ev, at: ev.publishedAt ?? ev.createdAt }))
    .filter((it) => it.at > since.toISOString() && it.at <= now.toISOString())
    .sort((a, b) => b.at.localeCompare(a.at));
  if (!inWindow.length) return null;

  const patches = cfg.patchLine ? inWindow.filter((i) => i.ev.kind === "release" && PATCH_RELEASE.test(i.ev.version ?? "")) : [];
  const cards = inWindow.filter((i) => !patches.includes(i));
  if (!cards.length && !patches.length) return null;

  const W = cfg.words;
  /* One item as blocks, in one language. A post without a translation has no Hebrew copy: its English blocks go to everyone. */
  const item = (it: Item, lead: boolean, lang: Lang, tagged: boolean): Block[] => {
    const { ev } = it;
    const he = lang === "he";
    const t = tag(tagged ? lang : null);
    const w = W[lang];
    const title = (he && ev.titleHe) || ev.title;
    const longText = (he && ev.summaryHe) || (!he && ev.lead && ev.lead.length > ev.summary.length ? ev.lead : ev.summary);
    const meta = [day(it.at, lang), ev.kind === "post" && ev.readMinutes ? settings.sender.draftLabels[lang].readValue.replace("{n}", String(ev.readMinutes)) : ""].filter(Boolean).join(" · ");
    const notes = ev.kind === "release" && !he ? (ev.notes ?? []).filter(Boolean) : [];
    const link = safeHref(urlFor(ev, lang));
    const label = ev.kind === "project" ? w.openProject : w.readMore;
    return [
      { type: "p", text: ev.kind === "release" ? (ev.version ?? title) : title, tone: "strong", ...t },
      { type: "p", text: meta, tone: "muted", ...t },
      ...(longText ? [{ type: "p" as const, text: clip(longText, cfg.excerptChars), ...t }] : []),
      ...(notes.length ? [{ type: "p" as const, text: w.whatChanged, tone: "strong" as const, ...t }, { type: "ul" as const, items: notes, ...t }] : []),
      ...(link ? [{ type: "cta" as const, url: link, label, ...(lead ? {} : { outline: true }), ...t }] : []),
    ];
  };
  const both = (it: Item, lead: boolean): Block[] => (hasHe(it.ev) && it.ev.kind === "post" ? [...item(it, lead, "en", true), ...item(it, lead, "he", true)] : item(it, lead, "en", false));
  const heading = (fn: (w: IssueSettings["words"]["en"]) => string): Block[] => (["en", "he"] as const).map((l) => ({ type: "h2" as const, text: fn(W[l]), lang: l }));

  const sections: Section[] = [];
  /* Releases by project. */
  const byProject = new Map<string, Item[]>();
  for (const it of cards.filter((i) => i.ev.kind === "release")) byProject.set(projectOf(it.ev), [...(byProject.get(projectOf(it.ev)) ?? []), it]);
  for (const [name, items] of byProject) sections.push({ newest: items[0].at, heading: heading((w) => w.newOn.replace("{name}", name)), items, render: both });
  /* New projects: one section each. */
  for (const it of cards.filter((i) => i.ev.kind === "project")) sections.push({ newest: it.at, heading: heading((w) => w.newProject.replace("{name}", it.ev.title)), items: [it], render: both });
  /* Posts by topic (the first tag). */
  const byTopic = new Map<string, Item[]>();
  for (const it of cards.filter((i) => i.ev.kind === "post")) {
    const topic = it.ev.tags[0]?.trim() || "";
    const key = topic.toLowerCase();
    byTopic.set(key, [...(byTopic.get(key) ?? []), it]);
  }
  for (const [key, items] of byTopic) {
    const topic = key ? (items[0].ev.tags[0] ?? "").trim() : "";
    sections.push({ newest: items[0].at, heading: topic ? [{ type: "h2", text: topic }] : heading((w) => w.otherPosts), items, render: both });
  }
  sections.sort((a, b) => b.newest.localeCompare(a.newest));

  const lead = cards[0];
  const blocks: Block[] = [
    { type: "p", text: cfg.intro.en, lang: "en" },
    { type: "p", text: cfg.intro.he, lang: "he" },
  ].filter((b) => b.text.trim()) as Block[];
  const cover = lead ? cardUrl(lead.ev, SITE_URL) : null;
  if (cover && lead) {
    const images: Block[] =
      lead.ev.kind === "post" && hasHe(lead.ev)
        ? [{ type: "image", url: cover, text: lead.ev.title, lang: "en" }, { type: "image", url: cover, text: lead.ev.titleHe ?? lead.ev.title, lang: "he" }]
        : [{ type: "image", url: cover, text: lead.ev.title }];
    blocks.push(...scoped(topicOf(lead.ev), images));
  }
  sections.forEach((s, si) => {
    const topic = topicOf(s.items[0].ev);
    const body = s.items.slice(0, cfg.maxPerSection).flatMap((it, i) => [...(i ? [{ type: "dot" as const }] : []), ...s.render(it, it === lead)]);
    blocks.push(...scoped(topic, [...(si ? [{ type: "rule" as const }] : []), ...s.heading, ...body]));
  });
  if (patches.length) {
    if (sections.length) blocks.push(...scoped("releases", [{ type: "rule" }]));
    for (const l of ["en", "he"] as const) blocks.push({ type: "p", text: `${W[l].alsoShipped}: ${patches.map((p) => `${projectOf(p.ev)} ${p.ev.version ?? p.ev.ref}`).join(", ")}`, tone: "muted", lang: l, topic: "releases" });
  }
  for (const l of ["en", "he"] as const) if (cfg.outro[l].trim()) blocks.push({ type: "p", text: cfg.outro[l], lang: l });

  const w = W.en;
  /* The subject and preview line for a set of items: the whole issue, and each topic on its own. */
  const linesFor = (items: Item[]) => {
    const notes = items.filter((i) => i.ev.kind !== "release").length;
    const releases = items.length - notes;
    const parts = [
      notes ? (notes === 1 ? w.noteOne : w.noteMany).replace("{n}", String(notes)) : "",
      releases ? (releases === 1 ? w.releaseOne : w.releaseMany).replace("{n}", String(releases)) : "",
    ].filter(Boolean);
    const subject = `${parts.join(` ${w.and} `)} ${w.since.replace("{date}", day(since.toISOString(), "en"))}`;
    const first = items.find((i) => cards.includes(i));
    return { notes, releases, lines: { subject: subject.slice(0, 200), preheader: clip(first ? first.ev.title : subject, 100) } };
  };
  const all = linesFor(inWindow);
  const topicLines: Issue["topicLines"] = { ...all.lines };
  for (const topic of ["blog", "releases"] as const) {
    const items = inWindow.filter((i) => topicOf(i.ev) === topic);
    if (items.length) topicLines[topic] = linesFor(items).lines;
  }
  return {
    blocks,
    bodyText: blocksText(blocks),
    ...all.lines,
    topicLines,
    name: `Issue ${now.toISOString().slice(0, 10)}`,
    notes: all.notes,
    releases: all.releases,
    since: since.toISOString(),
    until: now.toISOString(),
  };
}

/** Compiles and stores a DRAFT issue, or returns null when the window is empty. */
export async function compileIssue(now = new Date(), opts: { since?: string } = {}): Promise<Campaign | null> {
  const settings = await loadSettings();
  const since = windowStart(await listCampaigns(), settings.sender.issue, now, opts.since);
  const issue = buildIssue(await listEvents(500), settings, now, since);
  if (!issue) return null;
  const stamp = now.toISOString();
  const c: Campaign = {
    _id: campaignId(`issue-${stamp.slice(0, 10)}-${randomBytes(3).toString("hex")}`),
    type: "campaign",
    name: issue.name,
    subject: issue.subject,
    preheader: issue.preheader,
    topicLines: issue.topicLines,
    bodyText: issue.bodyText,
    blocks: issue.blocks,
    groups: [SYSTEM_GROUP],
    lang: "all",
    kind: "issue",
    compiledUntil: stamp,
    labelAd: false,
    status: "draft",
    counters: { queued: 0, sent: 0, failed: 0, suppressed: 0 },
    createdAt: stamp,
    updatedAt: stamp,
  };
  await createCampaign(c);
  return c;
}

/**
 * Optional weekly / monthly compile (default off). Checked whenever an event is
 * recorded: due when the newest issue was compiled at least a week / a month ago
 * and the owner is not already holding an unsent draft. Makes a draft only.
 */
export async function maybeAutoCompile(settings: AnnounceSettings, now = new Date()): Promise<Campaign | null> {
  const mode = settings.sender.issue.autoCompile;
  if (mode === "off") return null;
  const issues = (await listCampaigns()).filter((c) => c.kind === "issue");
  if (issues.some((c) => c.status === "draft")) return null;
  const last = issues.map((c) => c.compiledUntil ?? c.createdAt).sort().pop();
  if (last && now.getTime() - Date.parse(last) < (mode === "weekly" ? 7 : 30) * DAY) return null;
  return compileIssue(now);
}
