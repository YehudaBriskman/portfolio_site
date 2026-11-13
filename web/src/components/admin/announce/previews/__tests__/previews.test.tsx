import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CardPreview, EmailPreview, InstagramPreview, LinkedInPreview, WhatsAppPreview, XPreview } from "..";

afterEach(cleanup);

describe("sources", () => {
  it("never use dangerouslySetInnerHTML or innerHTML", () => {
    const dirs = [path.resolve(__dirname, ".."), path.resolve(__dirname, "../../../../../lib/share/preview")];
    for (const dir of dirs)
      for (const f of fs.readdirSync(dir).filter((n) => /\.(tsx?|css)$/.test(n))) {
        expect(fs.readFileSync(path.join(dir, f), "utf8"), f).not.toMatch(/dangerouslySetInnerHTML|innerHTML/);
      }
  });
});

describe("LinkedInPreview", () => {
  const long = "word ".repeat(80).trim();
  it("folds, expands and collapses; shows the approximate label", () => {
    render(<LinkedInPreview text={long} url="https://www.a.com/x" title="T" />);
    expect(screen.getByText("Approximate")).toBeTruthy();
    const more = screen.getByRole("button", { name: /see more/i });
    expect(more.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(more);
    expect(screen.getByRole("button", { name: /see less/i }).getAttribute("aria-expanded")).toBe("true");
  });
  it("renders markup as text and the link card domain", () => {
    const { container } = render(<LinkedInPreview text="<b>hi</b>" url="https://www.a.com/x" title="<i>T</i>" />);
    expect(container.querySelector("b, i")).toBeNull();
    expect(screen.getByText("<b>hi</b>")).toBeTruthy();
    expect(screen.getByText("a.com")).toBeTruthy();
  });
  it("shows the empty and over states", () => {
    const { rerender } = render(<LinkedInPreview text="" />);
    expect(screen.getByText("Nothing to preview yet.")).toBeTruthy();
    rerender(<LinkedInPreview text={"a".repeat(3001)} />);
    expect(screen.getByText(/1 over the limit/)).toBeTruthy();
  });
  it("gives each line dir=auto (Hebrew)", () => {
    const { container } = render(<LinkedInPreview text={"שלום\nhello"} />);
    const lines = container.querySelectorAll("p.pv-line");
    expect(lines.length).toBe(2);
    lines.forEach((l) => expect(l.getAttribute("dir")).toBe("auto"));
  });
});

describe("XPreview", () => {
  it("counts a link as 23 and offers no thread when it fits", () => {
    render(<XPreview text={`hi https://example.com/${"p".repeat(200)}`} />);
    expect(screen.getByText("26 of 280 characters")).toBeTruthy();
    expect(screen.queryByText("Suggested thread")).toBeNull();
  });
  it("suggests a numbered thread when over", () => {
    const text = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
    render(<XPreview text={text} />);
    expect(screen.getByText(/over the limit/)).toBeTruthy();
    expect(screen.getByText("Post 1 of 2")).toBeTruthy();
  });
});

describe("WhatsAppPreview", () => {
  it("renders a bubble with the link as text and a card", () => {
    const { container } = render(<WhatsAppPreview text={"Look *here*\nhttps://a.com/p"} title="T" />);
    expect(container.querySelector("strong")?.textContent).toBe("here");
    expect(container.querySelector(".pv-link")?.textContent).toBe("https://a.com/p");
    expect(container.querySelector("a")).toBeNull();
    expect(screen.getByText("T")).toBeTruthy();
  });
});

describe("InstagramPreview", () => {
  it("toggles the frame, counts hashtags, folds the caption", () => {
    const { container } = render(<InstagramPreview text={`${"word ".repeat(40)}#a #b`} image="https://a.com/s.png" />);
    expect(container.querySelector(".pv-ig-frame")?.getAttribute("data-frame")).toBe("square");
    fireEvent.click(screen.getByRole("button", { name: "Story" }));
    expect(container.querySelector(".pv-ig-frame")?.getAttribute("data-frame")).toBe("story");
    expect(screen.getByRole("button", { name: "Story" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText(/2 of 30 hashtags/)).toBeTruthy();
    const more = screen.getByRole("button", { name: /more/i });
    fireEvent.click(more);
    expect(more.getAttribute("aria-expanded")).toBe("true");
  });
  it("refuses a javascript: image", () => {
    const { container } = render(<InstagramPreview text="x" image="javascript:alert(1)" />);
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("CardPreview", () => {
  it("builds the card address for each format and language", () => {
    const { container } = render(<CardPreview kind="blog" file="a note.png" lang="he" />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/api/seo/og/blog/a%20note.png?lang=he");
    fireEvent.click(screen.getByRole("button", { name: "Square" }));
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/api/seo/og/blog/a%20note.png?format=square&lang=he");
  });
  it("shows an error with a retry when the image fails", () => {
    const { container } = render(<CardPreview kind="projects" file="w.png" lang="en" />);
    fireEvent.error(container.querySelector("img")!);
    expect(screen.getByRole("alert").textContent).toMatch(/could not be loaded/);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(container.querySelector("img")).not.toBeNull();
  });
});

describe("EmailPreview", () => {
  const html = "<!doctype html><html><head><title>x</title></head><body><p>Hello</p></body></html>";
  it("uses a fully sandboxed iframe with the policy added", () => {
    const { container } = render(<EmailPreview html={html} text="Hello" subject="Hi" />);
    const f = container.querySelector("iframe")!;
    expect(f.getAttribute("sandbox")).toBe("");
    expect(f.getAttribute("sandbox")).not.toMatch(/allow-scripts/);
    expect(f.getAttribute("srcdoc")).toContain("Content-Security-Policy");
    expect(f.getAttribute("srcdoc")).toContain("<p>Hello</p>");
    expect(f.getAttribute("title")).toBe("Email preview: Hi");
  });
  it("toggles width and colour scheme", () => {
    const { container } = render(<EmailPreview html={html} />);
    const f = () => container.querySelector("iframe")!;
    expect(f().style.width).toBe("600px");
    fireEvent.click(screen.getByRole("button", { name: "Mobile 390" }));
    expect(f().style.width).toBe("390px");
    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    expect(f().style.colorScheme).toBe("dark");
  });
  it("shows the plain text as text, or says there is none", () => {
    const { container, rerender } = render(<EmailPreview html={html} text="<b>raw</b>" />);
    fireEvent.click(screen.getByRole("button", { name: "Plain text" }));
    expect(container.querySelector("iframe")).toBeNull();
    expect(screen.getByText("<b>raw</b>")).toBeTruthy();
    rerender(<EmailPreview html={html} />);
    expect(screen.getByText("There is no plain-text version.")).toBeTruthy();
  });
  it("says so when there is no email", () => {
    render(<EmailPreview html="  " />);
    expect(screen.getByText("There is no email to show.")).toBeTruthy();
  });
});
