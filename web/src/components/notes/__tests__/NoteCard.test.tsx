import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import NoteCard from "@/components/notes/NoteCard";
import type { PostSummary } from "@/services/blog";

/*
 * The note card on /blog (#179): one height, a description that opens, and
 * a dark card on the page's paper. jsdom has no layout, so the heights themselves are
 * measured in a browser (`scripts/shoot-notes-dark.mjs`); what is checked
 * here is the contract the stylesheet's heights rest on, and the stylesheet's
 * own at-rules, which jsdom does not evaluate.
 */

const CSS = readFileSync(
  resolve(process.cwd(), "src/components/notes/NoteCard.module.css"),
  "utf8"
).replace(/\/\*[\s\S]*?\*\//g, "");

const note = (over: Partial<PostSummary> = {}): PostSummary => ({
  slug: "sticky-timelines",
  title: "Why sticky breaks a scroll timeline",
  subtitle: "What a pinned element does to a view timeline",
  excerpt: "A pinned element stops moving relative to the scrollport.",
  publishedAt: "2026-03-18T00:00:00.000Z",
  tags: [],
  collection: "site",
  coverImage: null,
  readingMinutes: 6,
  ...over,
});

function card(post: PostSummary, lead = false) {
  return render(
    <MemoryRouter>
      <NoteCard post={post} lead={lead} />
    </MemoryRouter>
  ).container;
}

describe("the note card", () => {
  it("is a slot with the card hung inside it, the cycle on the slot", () => {
    const root = card(note());
    const slot = root.querySelector("article")!;
    const face = slot.firstElementChild!;
    expect(face.classList.contains("note-card")).toBe(true);
    /* The hue cycle is `nth-child`, so it must sit on the grid's child. */
    expect(slot.className).toMatch(/cycle/);
    expect(face.className).not.toMatch(/cycle/);
  });

  it("carries the description, and says so only when there is one", () => {
    const said = card(note());
    expect(said.querySelector("[data-desc]")).not.toBeNull();
    expect(said.textContent).toContain("What a pinned element does to a view timeline");

    /* The excerpt speaks when there is no subtitle. */
    const excerpt = card(note({ subtitle: null }));
    expect(excerpt.textContent).toContain("A pinned element stops moving");

    /* An empty excerpt is the API's default; no description, no growth. */
    const mute = card(note({ subtitle: null, excerpt: "  " }));
    expect(mute.querySelector("[data-desc]")).toBeNull();
  });

  it("keeps a cover only where the note has one, and the lead always has a picture", () => {
    expect(card(note()).querySelector("[data-cover]")).toBeNull();
    expect(card(note({ coverImage: "https://example.com/c.jpg" })).querySelector("[data-cover] img")).not.toBeNull();
    expect(card(note(), true).querySelector("[data-cover]")).not.toBeNull();
  });

  it("gives every slot one height and opens the card inside it", () => {
    expect(CSS).toMatch(/\.slot\s*\{[^}]*height:\s*calc\(var\(--note-rest\) \+ var\(--note-grow\)\)/);
    expect(CSS).toMatch(/\.face\s*\{[^}]*height:\s*calc\(var\(--note-rest\) \+ var\(--note-open\)\)/);
    expect(CSS).toMatch(/@property --note-open/);
    /* Touch, reduced motion and Pause stand every card open and still. */
    expect(CSS).toMatch(/@media not \(\(hover: hover\) and \(pointer: fine\)\)\s*\{\s*\.face\s*\{\s*--note-open:\s*var\(--note-grow\)/);
    expect(CSS).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.face\s*\{\s*--note-open:\s*var\(--note-grow\);\s*transition:\s*none/);
    expect(CSS).toMatch(/:global\(body\.motion-paused\) \.face\s*\{\s*--note-open:\s*var\(--note-grow\);\s*transition:\s*none/);
  });

  it("is a dark card itself, on a page that stays paper", () => {
    const face = card(note()).querySelector("article > div")!;
    expect(face.classList.contains("on-panel")).toBe(true);
    /* Not a ground the nav passes over. */
    expect(face.hasAttribute("data-chrome")).toBe(false);
    /* The washes are paper's and the face drops them for its dark fill. */
    expect(CSS).toMatch(/\.card\.card\.face\s*\{[^}]*background-color:\s*rgb\(var\(--canvas\)\)/);
  });

  it("leaves the compact prev/next card on paper", () => {
    const root = render(
      <MemoryRouter>
        <NoteCard post={note()} compact />
      </MemoryRouter>
    ).container;
    expect(root.querySelector(".on-panel")).toBeNull();
  });
});
