import { afterEach, describe, expect, it, vi } from "vitest";
import { admin } from "../admin";
import { formatBytes, formatDuration, media } from "../media";
import { translationReport } from "../translations";
import { unreadableCount } from "../tolerant";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
afterEach(() => vi.unstubAllGlobals());

describe("formatBytes / formatDuration on bad numbers", () => {
  it("a negative duration is not '-1:-5'", () => expect(formatDuration(-5000)).not.toMatch(/-/));
  it("NaN and Infinity durations are not printed", () => {
    expect(formatDuration(Number.NaN)).not.toMatch(/NaN/);
    expect(formatDuration(Infinity)).not.toMatch(/Infinity/);
  });
  it("NaN / negative bytes are not printed as NaN or a minus", () => {
    expect(formatBytes(Number.NaN)).not.toMatch(/NaN/);
    expect(formatBytes(-5)).not.toMatch(/-/);
  });
  it("good numbers are unchanged", () => {
    expect(formatDuration(65_000)).toBe("1:05");
    expect(formatBytes(2048)).toMatch(/2 KB/);
  });
});

const post = (slug: string, status: string) => ({ slug, title: slug, subtitle: null, excerpt: "", body: "", status, publishedAt: null, updatedAt: "2026-11-01T00:00:00Z", tags: [], readingMinutes: 1 });
const area = (slug: string, status: string) => ({ slug, title: slug, description: "", coverImage: null, links: [], order: 1, status });

describe("one odd record must not discard the whole list", () => {
  it("admin.list keeps the readable posts when one has a status this build does not know", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ ok: true, items: [post("good", "published"), post("odd", "scheduled")] })));
    const list = await admin.list();
    expect(list.map((p) => p.slug)).toEqual(["good"]);
    expect(unreadableCount(list)).toBe(1);
  });
  it("admin.collections keeps the readable areas", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ ok: true, items: [area("a", "published"), area("b", "archived")] })));
    const list = await admin.collections();
    expect(list.map((c) => c.slug)).toEqual(["a"]);
    expect(unreadableCount(list)).toBe(1);
  });
  it("admin.mcpGrants keeps the readable grants", async () => {
    const grant = (id: string, status: string) => ({ id, client: "c", scopes: [], login: "o", createdAt: "x", lastUsedAt: null, expiresAt: "x", revokedAt: null, revokedReason: null, status });
    vi.stubGlobal("fetch", vi.fn(async () => json({ ok: true, items: [grant("1", "active"), grant("2", "pending")] })));
    const r = await admin.mcpGrants();
    expect(r.map((g) => g.id)).toEqual(["1"]);
    expect(unreadableCount(r)).toBe(1);
  });
  it("media.list keeps readable items when one has an unknown kind", async () => {
    const item = (id: string, kind: string) => ({ id, name: id, alt: "", caption: "", credit: "", kind, format: "jpeg", mime: "image/jpeg", file: null, width: 1, height: 1, bytes: 1, createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z", url: "u", preview: "p", srcset: { avif: "", webp: "" }, largest: { avif: null, webp: null }, usedBy: [] });
    vi.stubGlobal("fetch", vi.fn(async () => json({ ok: true, items: [item("a", "image"), item("b", "audio")] })));
    const r = await media.list();
    expect(r.map((m) => m.id)).toEqual(["a"]);
    expect(unreadableCount(r)).toBe(1);
  });
});

describe("translationReport on an HTML shell", () => {
  it("rejects with 'api-down' like the other admin services, not a JSON parse error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<!doctype html><html></html>", { status: 200, headers: { "Content-Type": "text/html" } })));
    const e = await translationReport().catch((x: Error) => x);
    expect((e as Error).message).toBe("api-down");
  });
});
