import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { outsideNoPreference, readCss } from "@/test/noPreference";
import { Skeleton } from "@/components/ui/Skeleton";

const css = readCss(resolve(__dirname, "Skeleton.module.css"));
const cols = [{ id: "t", width: "2fr" }, { id: "s", width: "6rem" }, { id: "n", width: "5rem", align: "num" as const }];

describe("Skeleton", () => {
  it("draws rows with the real column template, so nothing shifts when the data lands", () => {
    const { container } = render(<Skeleton columns={cols} rows={4} label="Loading" />);
    expect(container.querySelectorAll("[data-skeleton-row]")).toHaveLength(4);
    const row = container.querySelector<HTMLElement>("[data-skeleton-row]")!;
    expect(row.style.gridTemplateColumns).toBe("2fr 6rem 5rem");
    expect(row.children).toHaveLength(3);
  });

  it("is a busy status with one spoken word, the bars hidden from assistive tech", () => {
    const { container } = render(<Skeleton columns={cols} rows={2} label="Loading" />);
    expect(screen.getByRole("status").textContent).toBe("Loading");
    expect(container.firstElementChild?.getAttribute("aria-busy")).toBe("true");
    expect(container.querySelector("[data-skeleton-row]")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("takes a row height", () => {
    const { container } = render(<Skeleton columns={cols} rows={1} height="3.5rem" label="Loading" />);
    expect((container.querySelector("[data-skeleton-row]") as HTMLElement).style.blockSize).toBe("3.5rem");
  });

  it("has a cards variant for the phone list", () => {
    const { container } = render(<Skeleton variant="cards" rows={3} label="Loading" />);
    expect(container.querySelectorAll("[data-skeleton-row]")).toHaveLength(3);
  });

  it("is static: no animation at all (the motion contract allows none that is clock-driven)", () => {
    expect(css).not.toMatch(/animation|@keyframes/);
  });
});
