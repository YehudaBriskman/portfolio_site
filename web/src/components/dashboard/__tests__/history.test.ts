import { describe, expect, it } from "vitest";
import {
  dayKey,
  groupByDay,
  isForeignKey,
  noteId,
  stepIndex,
  topicBreakdown,
  wasUpdated,
} from "@/components/dashboard/history";
import { headingSlug, rehypeHeadingIds } from "@/components/notes/headingIds";

describe("noteId", () => {
  it("is seven hex digits, and the same for the same slug every time", () => {
    const id = noteId("why-ci-must-fail");
    expect(id).toMatch(/^[0-9a-f]{7}$/);
    expect(noteId("why-ci-must-fail")).toBe(id);
  });

  it("is pinned, so an id a reader has seen never changes under them", () => {
    // FNV-1a 32-bit: "" is the offset basis, 811c9dc5.
    expect(noteId("")).toBe("811c9dc");
    expect(noteId("a")).toBe("e40c292");
  });

  it("tells neighbouring slugs apart, including Hebrew ones", () => {
    const ids = ["a-note", "a-notes", "b-note", "רשימה", "רשימה-2"].map(noteId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("groupByDay", () => {
  const n = (slug: string, publishedAt: string | null) => ({ slug, publishedAt });

  it("groups by calendar day, newest day and newest note first, undated last", () => {
    const groups = groupByDay(
      [
        n("old", "2026-10-30T09:00:00.000Z"),
        n("none", null),
        n("morning", "2026-11-02T07:00:00.000Z"),
        n("evening", "2026-11-02T18:00:00.000Z"),
      ],
      "UTC",
    );
    expect(groups.map((g) => g.day)).toEqual(["2026-11-02", "2026-10-30", ""]);
    expect(groups[0].items.map((i) => i.slug)).toEqual(["evening", "morning"]);
    expect(groups[2].at).toBeNull();
  });

  it("uses the reader's day, not UTC's", () => {
    // 23:30 UTC on 1 Nov is already 2 Nov in Jerusalem.
    expect(dayKey("2026-11-01T23:30:00.000Z", "Asia/Jerusalem")).toBe("2026-11-02");
    expect(dayKey("2026-11-01T23:30:00.000Z", "UTC")).toBe("2026-11-01");
    const groups = groupByDay([n("late", "2026-11-01T23:30:00.000Z"), n("early", "2026-11-02T06:00:00.000Z")], "Asia/Jerusalem");
    expect(groups).toHaveLength(1);
  });
});

describe("wasUpdated", () => {
  it("is a save well after publishing, not the publishing itself", () => {
    const pub = "2026-11-01T10:00:00.000Z";
    expect(wasUpdated({ publishedAt: pub, updatedAt: "2026-11-01T10:20:00.000Z" })).toBe(false);
    expect(wasUpdated({ publishedAt: pub, updatedAt: "2026-11-03T10:00:00.000Z" })).toBe(true);
    expect(wasUpdated({ publishedAt: pub, updatedAt: null })).toBe(false);
    expect(wasUpdated({ publishedAt: null, updatedAt: pub })).toBe(false);
  });
});

describe("topicBreakdown", () => {
  it("counts each topic once per note, biggest first, the tail folded into other", () => {
    const r = topicBreakdown(
      [{ tags: ["ci", "ci", "dns"] }, { tags: ["ci"] }, { tags: ["a"] }, { tags: ["b"] }, { tags: ["c"] }],
      3,
    );
    expect(r.shares).toEqual([
      { tag: "ci", count: 2 },
      { tag: "a", count: 1 },
      { tag: "b", count: 1 },
    ]);
    expect(r.other).toBe(2);
    expect(r.total).toBe(6);
  });
});

describe("j / k", () => {
  it("steps one at a time, clamped, entering from either end", () => {
    expect(stepIndex(-1, 1, 3)).toBe(0);
    expect(stepIndex(-1, -1, 3)).toBe(2);
    expect(stepIndex(0, 1, 3)).toBe(1);
    expect(stepIndex(2, 1, 3)).toBe(2);
    expect(stepIndex(0, -1, 3)).toBe(0);
    expect(stepIndex(-1, 1, 0)).toBe(-1);
  });

  it("leaves typing, modified keys and open dialogs alone", () => {
    const input = document.createElement("input");
    const link = document.createElement("a");
    const dialog = document.createElement("dialog");
    dialog.setAttribute("open", "");
    const inDialog = document.createElement("a");
    dialog.append(inDialog);
    document.body.append(input, link, dialog);
    const key = (target: EventTarget, mods: Partial<KeyboardEvent> = {}) =>
      isForeignKey({ altKey: false, ctrlKey: false, metaKey: false, target, ...mods });
    expect(key(input)).toBe(true);
    expect(key(inDialog)).toBe(true);
    expect(key(link, { ctrlKey: true })).toBe(true);
    expect(key(link)).toBe(false);
    document.body.replaceChildren();
  });
});

describe("heading ids", () => {
  it("slugs the way GitHub does, keeping Hebrew", () => {
    expect(headingSlug("Why CI must fail!")).toBe("why-ci-must-fail");
    expect(headingSlug("  שלב  ראשון ")).toBe("שלב--ראשון");
  });

  it("numbers repeats in document order", () => {
    const h = (tagName: string, text: string) => ({
      type: "element",
      tagName,
      properties: {} as Record<string, unknown>,
      children: [{ type: "text", value: text }],
    });
    const tree = { type: "root", children: [h("h2", "Setup"), h("p", "x"), h("h3", "Setup"), h("h2", "!!")] };
    rehypeHeadingIds()(tree);
    expect(tree.children.map((c) => c.properties.id)).toEqual(["setup", undefined, "setup-1", "section"]);
  });
});
