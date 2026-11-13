import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { FileText, Clock, Languages } from "lucide-react";
import { RecordRow, MAX_FACTS } from "@/components/ui/RecordRow";
import { StatusGlyph } from "@/components/ui/StatusGlyph";

const css = readFileSync(resolve(__dirname, "RecordRow.module.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

afterEach(() => {
  vi.useRealTimers();
  document.documentElement.removeAttribute("lang");
});

const base = { icon: FileText, title: "Launch notes", openLabel: "Open Launch notes", onOpen: () => {} };

describe("RecordRow", () => {
  it("is one button named by openLabel, with nothing interactive inside", () => {
    const { container } = render(
      <RecordRow {...base} facts={[{ text: "2h ago", icon: Clock }]} status={<StatusGlyph kind="failed" />} />,
    );
    const btn = screen.getByRole("button", { name: "Open Launch notes" });
    expect(container.querySelectorAll("button, a, input, select, textarea, [tabindex]").length).toBe(1);
    expect(btn.hasAttribute("data-record-row")).toBe(true);
  });

  it("calls onOpen when the row is pressed", () => {
    const onOpen = vi.fn();
    render(<RecordRow {...base} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("shows at most two facts, and says the limit", () => {
    expect(MAX_FACTS).toBe(2);
    const facts = [{ text: "one" }, { text: "two" }, { text: "three" }] as unknown as [{ text: string }, { text: string }];
    const { container } = render(<RecordRow {...base} facts={facts} />);
    const shown = container.querySelectorAll(".rr-fact");
    expect(shown.length).toBe(2);
    expect(screen.queryByText("three")).toBeNull();
  });

  it("types a third fact as an error", () => {
    // @ts-expect-error a row carries at most two facts
    const three: Parameters<typeof RecordRow>[0]["facts"] = [{ text: "a" }, { text: "b" }, { text: "c" }];
    expect(three.length).toBe(3);
  });

  it("title is bidi-isolated and auto direction", () => {
    const { container } = render(<RecordRow {...base} title="פוסט ראשון" openLabel="פתח" />);
    const t = container.querySelector("[data-rr-title]")!;
    expect(t.getAttribute("dir")).toBe("auto");
    expect(t.querySelector("bdi")).toBeTruthy();
  });

  it("gives a fact a forced direction when it is an id or a path", () => {
    const { container } = render(<RecordRow {...base} facts={[{ text: "/a/b", dir: "ltr" }]} />);
    expect(container.querySelector(".rr-fact bdi")!.getAttribute("dir")).toBe("ltr");
  });

  it("a status glyph inside the row keeps its own accessible name", () => {
    render(<RecordRow {...base} status={<StatusGlyph kind="failed" />} />);
    expect(screen.getByRole("img", { name: "Failed" }).getAttribute("aria-label")).toBe("Failed");
  });

  it("describes the row by its facts and status so a screen reader hears them", () => {
    render(<RecordRow {...base} facts={[{ text: "2h ago" }]} status={<StatusGlyph kind="failed" />} />);
    const btn = screen.getByRole("button");
    const d = document.getElementById(btn.getAttribute("aria-describedby")!);
    expect(d?.textContent).toContain("2h ago");
    expect(d?.querySelector("[aria-label='Failed']")).toBeTruthy();
  });

  it("unread draws a dot and says New to a screen reader", () => {
    const { container } = render(<RecordRow {...base} unread />);
    expect(container.querySelector("[data-rr-unread]")).toBeTruthy();
    expect(screen.getByText("New").className).toMatch(/sr|visually/i);
    expect(screen.getByRole("button").getAttribute("aria-describedby")).toBeTruthy();
  });

  it("unread says New in Hebrew too", () => {
    document.documentElement.lang = "he";
    render(<RecordRow {...base} unread />);
    expect(screen.getByText("חדש")).toBeTruthy();
  });

  it("selection mode makes the row a checkbox, not a nested one", () => {
    const { container } = render(<RecordRow {...base} selectable selected />);
    const row = screen.getByRole("checkbox", { name: "Open Launch notes" });
    expect(row.getAttribute("aria-checked")).toBe("true");
    expect(container.querySelectorAll("input").length).toBe(0);
  });

  it("long press (450ms) calls onLongPress and swallows the click; a move cancels it", () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    const onOpen = vi.fn();
    render(<RecordRow {...base} onOpen={onOpen} onLongPress={onLongPress} />);
    const btn = screen.getByRole("button");
    fireEvent.pointerDown(btn, { clientX: 10, clientY: 10, pointerId: 1 });
    act(() => {
      vi.advanceTimersByTime(460);
    });
    fireEvent.pointerUp(btn, { pointerId: 1 });
    fireEvent.click(btn);
    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();

    fireEvent.pointerDown(btn, { clientX: 10, clientY: 10, pointerId: 2 });
    fireEvent.pointerMove(btn, { clientX: 10, clientY: 40, pointerId: 2 });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("trailing defaults to a chevron that is decorative", () => {
    const { container } = render(<RecordRow {...base} />);
    expect(container.querySelector("[data-rr-chevron] svg[aria-hidden='true']")).toBeTruthy();
  });

  it("renders as a list item when asked", () => {
    const { container } = render(<ul><RecordRow {...base} as="li" /></ul>);
    expect(container.querySelector("ul > li > button")).toBeTruthy();
  });

  it("accepts a language icon without crashing (any lucide icon)", () => {
    render(<RecordRow {...base} icon={Languages} />);
    expect(screen.getByRole("button")).toBeTruthy();
  });
});

describe("RecordRow CSS", () => {
  it("is at least 56px tall, never under 44px, and a button reset", () => {
    expect(css).toMatch(/\.row\s*\{[^}]*min-block-size:\s*3\.5rem/);
    expect(css).toMatch(/touch-action:\s*manipulation/);
  });
  it("has a min-width:0 title column and logical properties", () => {
    expect(css).toMatch(/minmax\(0,\s*1fr\)/);
    expect(css).not.toMatch(/(^|[;{\s])(left|right|margin-left|margin-right|padding-left|padding-right)\s*:/m);
  });
  it("mirrors the chevron in rtl and keeps hover to hover devices", () => {
    expect(css).toMatch(/:dir\(rtl\)[^{]*\{[^}]*(rotate\(180deg\)|scaleX\(-1\))/);
    const noHover = css.replace(/@media \(hover: hover\)\s*\{(?:[^{}]*\{[^}]*\})*[^{}]*\}/g, "");
    expect(noHover).not.toMatch(/:hover/);
  });
  it("only moves under no-preference", () => {
    const outside = css.replace(/@media \(prefers-reduced-motion: no-preference\)\s*\{(?:[^{}]*\{[^}]*\})*[^{}]*\}/g, "");
    expect(outside).not.toMatch(/\btransition\s*:|scale\(|\banimation\s*:/);
  });
});
