import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import AuroraStrand from "@/components/motion/AuroraStrand";

/*
 * The one aurora strand and its one appearing (owner, 2026-11-03): the work
 * run and the notes shelf use this, and differ only in `from`, the clock and
 * the range. What it looks like in a browser, frame by frame, is in
 * docs/aurora-v3/.
 */
const SOURCE = readFileSync(resolve(process.cwd(), "src/components/motion/AuroraStrand.module.css"), "utf8");
const CSS = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "");
const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("AuroraStrand", () => {
  it("is decoration, says which side it comes from, and passes its clock as custom properties", () => {
    const { container } = render(<AuroraStrand from="left" timeline="--x" range="entry 0% exit 0%" />);
    const el = container.querySelector<HTMLElement>("[data-aurora-strand]")!;
    expect(el).toHaveAttribute("aria-hidden", "true");
    expect(el).toHaveAttribute("data-from", "left");
    expect(el.style.getPropertyValue("--strand-timeline")).toBe("--x");
    expect(el.style.getPropertyValue("--strand-range")).toBe("entry 0% exit 0%");
    /* The default drawing: a ribbon of fine strands, not one stroke. */
    expect(Number(el.querySelector("[data-strands]")?.getAttribute("data-strands"))).toBeGreaterThanOrEqual(5);
  });

  it("reads its caller's clock, and owns none of its own", () => {
    expect(CSS).toMatch(/animation-timeline:\s*var\(--strand-timeline\);/);
    expect(CSS).not.toMatch(/view-timeline/);
  });

  it("uncovers in place: a window in from `from`, its drawing carried back by the same amount", () => {
    for (const [name, sign] of [["aurora-sweep", ""], ["aurora-sweep-hold", "-"]]) {
      const kf = CSS.match(new RegExp(`@keyframes ${name}\\s*\\{([\\s\\S]*?)\\n\\}`))?.[1] ?? "";
      expect(kf).toContain(`translateX(calc(var(--sweep-sign) * ${sign}130cqw))`);
      expect(kf).toMatch(/to\s*\{\s*transform:\s*translateX\(0\)/);
    }
    expect(CSS).toMatch(/\.strand\[data-from="left"\][^{]*\{\s*--sweep-sign:\s*-1/);
    expect(CSS).not.toMatch(/animation-(duration|delay)/);
  });

  it("lands every off-switch on the strand whole and still", () => {
    expect(CSS).toMatch(/@supports not \(animation-timeline: view\(\)\)\s*\{\s*\.window,\s*\.hold\s*\{\s*animation:\s*none;\s*transform:\s*none;/);
    expect(CSS).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.window,\s*\.hold\s*\{\s*animation:\s*none;\s*transform:\s*none;/);
    expect(CSS).toMatch(/:global\(body\.motion-paused\) \.window,\s*:global\(body\.motion-paused\) \.hold\s*\{\s*animation:\s*none;\s*transform:\s*none;/);
  });

  it("is the one strand the run and the notes use: right for the run, left for the notes; none on 'How I work'", () => {
    expect(read("src/components/projects/RunAurora.tsx")).toMatch(/<AuroraStrand\s+from="right"\s+mirrorInRtl\s+timeline="--run"/);
    /* The owner's "remove the additional aurora": the line comes in by itself. */
    expect(read("src/components/Approach.tsx")).not.toMatch(/AuroraStrand/);
    expect(read("src/components/LatestNotes.tsx")).toMatch(
      /<AuroraStrand from="left" timeline="--notes-shelf" range="entry 40% contain 6%" \/>/,
    );
    /* No second copy of the appearing anywhere. */
    for (const f of ["src/components/projects/ProjectRun.module.css", "src/components/LatestNotes.module.css", "src/components/Approach.module.css"]) {
      expect(read(f).replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/130cqw/);
    }
  });
});
