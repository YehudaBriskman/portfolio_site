import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AvatarCircle from "@/components/phone/AvatarCircle";
import GroupedSection from "@/components/phone/GroupedSection";
import ListRow from "@/components/phone/ListRow";
import PillBadge from "@/components/phone/PillBadge";
import PinnedAction from "@/components/phone/PinnedAction";
import SegmentedTabs from "@/components/phone/SegmentedTabs";
import { StatGrid, StatTile } from "@/components/phone/StatTile";
import { toneOfArea, toneOfKind } from "@/components/phone/tone";

describe("toneOfArea", () => {
  it("is blue for the site and stable, from the palette, for any other area", () => {
    expect(toneOfArea("site")).toBe("blue");
    expect(toneOfArea("bothy")).toBe(toneOfArea("bothy"));
    expect(["green", "purple", "yellow", "red", "blue"]).toContain(toneOfArea("windom"));
  });
});

describe("AvatarCircle", () => {
  it("is decorative by default and carries its size and tone", () => {
    const { container } = render(
      <AvatarCircle size={56} tone="green">
        <svg />
      </AvatarCircle>,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute("data-phone-circle")).toBe("56");
    expect(el.getAttribute("data-tone")).toBe("green");
    expect(el.getAttribute("aria-hidden")).toBe("true");
  });

  it("names itself when it is the only content", () => {
    render(
      <AvatarCircle label="Bothy">
        <svg />
      </AvatarCircle>,
    );
    expect(screen.getByRole("img", { name: "Bothy" })).toBeTruthy();
  });
});

describe("PillBadge", () => {
  it("prints the word and keeps the page's own class", () => {
    render(
      <PillBadge className="page-pill" tone="blue" dataKind="use">
        In use
      </PillBadge>,
    );
    const el = screen.getByText("In use");
    expect(el.className).toContain("page-pill");
    expect(el.getAttribute("data-kind")).toBe("use");
  });
});

describe("toneOfKind", () => {
  it("maps each project state kind to one tone, the rest to neutral", () => {
    expect(["live", "use", "open", "release", "rest"].map(toneOfKind)).toEqual(["green", "blue", "purple", "yellow", "neutral"]);
  });
});

describe("StatTile and StatGrid", () => {
  it("shows the value as an LTR isolate with its label", () => {
    render(<StatTile icon={<svg />} value="v1.9.0" label="Latest release" />);
    const v = screen.getByText("v1.9.0");
    expect(v.getAttribute("dir")).toBe("ltr");
    expect(screen.getByText("Latest release")).toBeTruthy();
  });

  it("renders nothing when no datum exists (no empty box, no dash)", () => {
    const { container } = render(<StatGrid label="About">{[null, false as unknown as null]}</StatGrid>);
    expect(container.firstChild).toBeNull();
  });

  it("renders only the tiles it is given", () => {
    render(
      <StatGrid label="About">
        {[<StatTile key="a" icon={<svg />} value="12" label="Stars" />, null]}
      </StatGrid>,
    );
    expect(screen.getAllByText(/./).length).toBeGreaterThan(0);
    expect(document.querySelectorAll('[data-phone="stat-tile"]').length).toBe(1);
  });
});

describe("ListRow and GroupedSection", () => {
  it("is one link, with a decorative circle and a decorative chevron", () => {
    render(
      <MemoryRouter>
        <GroupedSection>
          <ul>
            <li>
              <ListRow to="/x" icon={<svg />} tone="blue">
                <span>Title</span>
                <span>meta</span>
              </ListRow>
            </li>
            <li>
              <ListRow href="https://example.com/r" icon={<svg />}>
                <span>Outbound</span>
              </ListRow>
            </li>
          </ul>
        </GroupedSection>
      </MemoryRouter>,
    );
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0].getAttribute("href")).toBe("/x");
    expect(links[1].getAttribute("rel")).toBe("noopener noreferrer");
    for (const l of links) {
      expect(l.querySelectorAll("[data-phone-circle]")).toHaveLength(1);
      expect(l.querySelector("[data-phone-chevron]")?.getAttribute("aria-hidden")).toBe("true");
    }
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});

describe("PinnedAction", () => {
  it("is a real link, sets the page flag while mounted, and clears it", () => {
    const { unmount } = render(<PinnedAction href="https://example.com/src">Source</PinnedAction>);
    expect(screen.getByRole("link", { name: "Source" }).getAttribute("href")).toBe("https://example.com/src");
    expect(document.documentElement.hasAttribute("data-has-pinned")).toBe(true);
    unmount();
    expect(document.documentElement.hasAttribute("data-has-pinned")).toBe(false);
  });
});

function Harness({ dir = "ltr" }: { dir?: "ltr" | "rtl" }) {
  const [sel, setSel] = useState<"a" | "b" | "c">("a");
  return (
    <div dir={dir} style={{ direction: dir }}>
      <SegmentedTabs
        label="Sections"
        idBase="x"
        selected={sel}
        onSelect={(k) => setSel(k as "a" | "b" | "c")}
        tabId={(b, k) => `${b}-tab-${k}`}
        panelId={(b, k) => `${b}-panel-${k}`}
        tabs={[
          { key: "a", label: "One" },
          { key: "b", label: "Two", count: 3 },
          { key: "c", label: "Three" },
        ]}
      />
    </div>
  );
}

describe("SegmentedTabs", () => {
  it("is a tablist with one tab stop and aria-selected on the current tab", () => {
    render(<Harness />);
    expect(screen.getByRole("tablist", { name: "Sections" })).toBeTruthy();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.tabIndex)).toEqual([0, -1, -1]);
    expect(tabs.map((t) => t.getAttribute("aria-selected"))).toEqual(["true", "false", "false"]);
    expect(tabs[1].getAttribute("aria-controls")).toBe("x-panel-b");
  });

  it("moves with the arrows and wraps, Home and End go to the ends", () => {
    render(<Harness />);
    const sel = () => screen.getAllByRole("tab").findIndex((t) => t.getAttribute("aria-selected") === "true");
    const list = screen.getByRole("tablist");
    fireEvent.keyDown(list, { key: "ArrowRight" });
    expect(sel()).toBe(1);
    fireEvent.keyDown(list, { key: "End" });
    expect(sel()).toBe(2);
    fireEvent.keyDown(list, { key: "ArrowRight" });
    expect(sel()).toBe(0);
    fireEvent.keyDown(list, { key: "ArrowLeft" });
    expect(sel()).toBe(2);
    fireEvent.keyDown(list, { key: "Home" });
    expect(sel()).toBe(0);
  });

  it("mirrors the arrows in a right-to-left page", () => {
    render(<Harness dir="rtl" />);
    const sel = () => screen.getAllByRole("tab").findIndex((t) => t.getAttribute("aria-selected") === "true");
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowLeft" });
    expect(sel()).toBe(1);
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowRight" });
    expect(sel()).toBe(0);
  });
});
