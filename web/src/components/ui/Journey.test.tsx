import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { Mail, Users, Clock } from "lucide-react";
import { outsideNoPreference, readCss } from "@/test/noPreference";
import { Journey, LifecycleStepper } from "@/components/ui/Journey";

const css = readCss(resolve(__dirname, "Journey.module.css"));
afterEach(() => {
  document.documentElement.lang = "en";
});

const STEPS = [
  { id: "draft", label: "Draft" },
  { id: "scheduled", label: "Scheduled" },
  { id: "sending", label: "Sending" },
  { id: "sent", label: "Sent" },
];

describe("Journey", () => {
  const props = {
    from: { icon: Mail, label: "hello@example.com", sub: "Sender" },
    to: { icon: Users, label: "Subscribers", sub: "1,240 people" },
  };

  it("is a named list with from first and to last", () => {
    render(<Journey {...props} />);
    const list = screen.getByRole("list", { name: "From hello@example.com to Subscribers" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain("hello@example.com");
    expect(items[1].textContent).toContain("Subscribers");
    expect(items[0].textContent).toContain("From");
    expect(items[1].textContent).toContain("To");
  });

  it("composes the name in Hebrew", () => {
    document.documentElement.lang = "he";
    render(<Journey {...props} />);
    expect(screen.getByRole("list", { name: /^מ.+ אל / })).toBeTruthy();
  });

  it("keeps waypoints between the endpoints, in order", () => {
    render(<Journey {...props} waypoints={[{ icon: Clock, label: "Fri 09:00" }]} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toContain("hello@example.com");
    expect(items[1].textContent).toContain("Fri 09:00");
    expect(items[2].textContent).toContain("Subscribers");
  });

  it("draws icons and the line as decoration, and isolates user text with bdi", () => {
    const { container } = render(<Journey {...props} />);
    for (const svg of container.querySelectorAll("svg")) expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelectorAll("bdi").length).toBeGreaterThanOrEqual(2);
    const lines = container.querySelectorAll("[data-journey-line]");
    expect(lines.length).toBe(1);
    expect(lines[0].getAttribute("aria-hidden")).toBe("true");
  });

  it("states its state in words, not only in the line style", () => {
    render(<Journey {...props} state="failed" />);
    const root = screen.getByRole("list");
    expect(root.getAttribute("data-state")).toBe("failed");
    expect(root.textContent).toMatch(/failed/i);
  });

  it("runs from the inline start: logical properties and a mirrored arrowhead", () => {
    expect(css).not.toMatch(/(^|[\s;{])(left|right|margin-left|margin-right|padding-left|padding-right)\s*:/);
    expect(css).toMatch(/:dir\(rtl\)[^{]*\{[^}]*scaleX\(-1\)/);
  });
});

describe("LifecycleStepper", () => {
  it("is an ordered list with exactly one current step, announced", () => {
    render(<LifecycleStepper steps={STEPS} current="scheduled" label="Campaign status" />);
    const list = screen.getByRole("list", { name: "Campaign status" });
    expect(list.tagName).toBe("OL");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    const current = items.filter((li) => li.getAttribute("aria-current") === "step");
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toContain("Scheduled");
    expect(current[0].textContent).toContain("current step");
    expect(items[0].textContent).toContain("done");
    expect(items[3].textContent).toContain("upcoming");
  });

  it("marks done, current and upcoming by shape as well as colour", () => {
    const { container } = render(<LifecycleStepper steps={STEPS} current="sending" />);
    const marks = [...container.querySelectorAll("[data-step-mark]")].map((m) => m.getAttribute("data-step-mark"));
    expect(marks).toEqual(["done", "done", "current", "upcoming"]);
    expect(container.querySelector('[data-step-mark="done"] svg')).toBeTruthy();
  });

  it("has no current step when current is absent", () => {
    const { container } = render(<LifecycleStepper steps={STEPS} />);
    expect(container.querySelectorAll('[aria-current="step"]')).toHaveLength(0);
  });

  it("draws paused and failed as a side branch of the current step, not a step", () => {
    render(<LifecycleStepper steps={STEPS} current="sending" branch="paused" />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(4);
    const branch = items[2].querySelector("[data-step-branch]")!;
    expect(branch.getAttribute("data-step-branch")).toBe("paused");
    expect(branch.textContent).toContain("paused");
    expect(branch.querySelector("svg")).toBeTruthy();
  });

  it("speaks Hebrew", () => {
    document.documentElement.lang = "he";
    render(<LifecycleStepper steps={STEPS} current="draft" />);
    expect(screen.getAllByRole("listitem")[0].textContent).toContain("השלב הנוכחי");
  });

  it("puts motion only under no-preference and never uses scroll timelines", () => {
    const outside = outsideNoPreference(css);
    expect(outside).not.toMatch(/\b(transition|animation)\s*:/);
    expect(outside).not.toMatch(/@keyframes/);
    expect(css).not.toMatch(/animation-timeline|animation-delay|animation-play-state/);
  });
});
