import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ICON } from "@/components/ui/icons";
import { KpiTile } from "@/components/ui/KpiTile";

const tile = (props: Partial<React.ComponentProps<typeof KpiTile>> = {}) =>
  render(
    <MemoryRouter>
      <KpiTile to="/admin/posts" icon={ICON.note} label="Posts" value="12" {...props} />
    </MemoryRouter>,
  );

describe("KpiTile", () => {
  it("is one link named by its label, value and delta", () => {
    tile({ delta: { text: "+3", tone: "up", label: "3 more than last month" } });
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/admin/posts");
    expect(link.textContent).toContain("Posts");
    expect(link.textContent).toContain("12");
    expect(link.textContent).toContain("+3");
    expect(link.getAttribute("aria-label")).toBe("Posts: 12, 3 more than last month");
  });

  it("draws a sparkline only from real values", () => {
    const { container, unmount } = tile({ series: { values: [1, 2, 3], label: "Posts, 12 weeks" } });
    expect(container.querySelector("svg[role=img]")).toBeTruthy();
    unmount();
    const none = tile({ series: { values: [], label: "none" } });
    expect(none.container.querySelector("svg[role=img]")).toBeNull();
  });

  it("holds the same slot with or without a drawing (equal tiles)", () => {
    const { container } = tile();
    expect(container.querySelector("[data-kpi-draw]")).toBeTruthy();
  });

  it("marks a danger tone with a word-bearing delta, not colour alone", () => {
    tile({ tone: "danger", delta: { text: "2 failed", tone: "down", label: "2 failed" } });
    expect(screen.getByRole("link").getAttribute("data-tone")).toBe("danger");
    expect(screen.getByRole("link").textContent).toContain("2 failed");
  });

  it("shows a dash value as given and keeps the value left-to-right", () => {
    const { container } = tile({ value: "—" });
    expect(container.querySelector("[data-kpi-value]")!.getAttribute("dir")).toBe("ltr");
  });
});
