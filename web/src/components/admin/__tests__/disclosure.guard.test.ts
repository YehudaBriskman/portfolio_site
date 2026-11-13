import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AudienceTab from "../announce/audience/AudienceTab";
import DataExport from "../announce/audience/DataExport";
import VisitorTemplates from "../announce/library/VisitorTemplates";
import CampaignEditor from "../announce/campaigns/CampaignEditor";
import SenderSection from "../announce/sender/SenderSection";
import SettingsPanel from "../announce/SettingsPanel";
import { DEFAULT_SENDER } from "../announce/sender/defaults";
import { DEFAULT_NOTIFY } from "../announce/notify/defaults";
import { DEFAULT_SETTINGS } from "@/settings/schema";

/*
 * Every expander goes through components/ui/Disclosure, so the chevron, the
 * 44px target and the RTL mirror live in one place. A raw <details> brings back
 * a summary with no affordance (Tailwind preflight makes flex summaries lose
 * the native marker).
 */

const SRC = join(__dirname, "..", "..", "..");

/* Files another change is still migrating. One per line so merges are easy; each PR deletes its own. */
const ALLOWLIST = [
  "pages/AdminSettings.tsx",
  "pages/AdminEditor.tsx",
  "pages/AdminCollection.tsx",
  "components/city/ContributionCity.tsx",
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== "__tests__" && name !== "node_modules") walk(p, out);
    } else if (/\.tsx?$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

describe("no raw <details>/<summary>", () => {
  it("only components/ui/Disclosure.tsx (and the allowlist) writes them", () => {
    const offenders = walk(SRC)
      .map((p) => relative(SRC, p).split(sep).join("/"))
      .filter((rel) => rel !== "components/ui/Disclosure.tsx" && !ALLOWLIST.includes(rel))
      .filter((rel) =>
        readFileSync(join(SRC, rel), "utf8")
          .split("\n")
          .some((line) => !/^\s*(\*|\/\/|\/\*)/.test(line) && /<(details|summary)[\s>]/.test(line)),
      );
    expect(offenders).toEqual([]);
  });

  it("the allowlist has no stale entries", () => {
    for (const rel of ALLOWLIST) expect(readFileSync(join(SRC, rel), "utf8")).toMatch(/<details[\s>]/);
  });
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const announce = {
  enabled: true, email: { enabled: false, events: ["post"] }, hashtags: [], signature: "", channels: ["linkedin"], templates: { en: {}, he: {} },
  snippets: [], library: [], advanced: { utm: { enabled: false, source: "announce", mediumByChannel: {} } }, sender: { ...DEFAULT_SENDER }, notify: DEFAULT_NOTIFY,
};
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/admin/announce/settings") return json({ ok: true, exists: true, _rev: "1-a", updatedAt: null, settings: announce });
      if (url === "/api/admin/settings") return json({ ok: true, exists: true, _rev: "9-z", version: 1, updatedAt: null, history: [], settings: DEFAULT_SETTINGS });
      if (url === "/api/admin/audience/groups") return json({ ok: true, groups: [] });
      if (url.startsWith("/api/admin/audience/contacts")) return json({ ok: true, contacts: [], nextCursor: null });
      return json({ ok: true });
    }),
  );
});
afterEach(() => (cleanup(), vi.unstubAllGlobals()));

const el = (c: unknown, p: object = {}) => createElement(MemoryRouter, null, createElement(c as never, p));
const editor = () => el(CampaignEditor, { id: "new", sender: null, groups: [], events: [], onClose: () => {}, onChanged: () => {} });

const CASES: Array<[string, () => ReturnType<typeof el>, number]> = [
  ["CampaignEditor", editor, 2],
  ["VisitorTemplates", () => el(VisitorTemplates), 1],
  ["AudienceTab", () => el(AudienceTab), 2],
  ["DataExport", () => el(DataExport), 1],
  ["SettingsPanel", () => el(SettingsPanel), 1],
  ["SenderSection", () => el(SenderSection, { sender: { ...DEFAULT_SENDER }, onChange: () => {}, warnings: [] }), 1],
];

describe("every summary has a chevron", () => {
  it.each(CASES)("%s", async (_n, make, min) => {
    const { container } = render(make());
    await waitFor(() => expect(container.querySelectorAll("summary").length).toBeGreaterThanOrEqual(min), { timeout: 3000 });
    for (const s of container.querySelectorAll("summary")) {
      const first = s.firstElementChild;
      expect(first?.tagName.toLowerCase(), s.textContent ?? "").toBe("svg");
      expect(first?.getAttribute("aria-hidden")).toBe("true");
    }
  });
});

describe("campaign composer labels", () => {
  it("does not say 'Use blocks' twice, and has no vague 'More'", async () => {
    const { container } = render(editor());
    await waitFor(() => expect(container.querySelectorAll("summary").length).toBeGreaterThanOrEqual(2));
    const texts = [...container.querySelectorAll("summary")].map((s) => s.textContent?.trim());
    expect(texts).not.toContain("More");
    const checkbox = container.querySelector("input[type=checkbox]")!.closest("label")!.textContent!.trim();
    expect(texts).not.toContain(checkbox);
    expect(screen.getAllByText(checkbox)).toHaveLength(1);
  });
});

describe("Advanced settings", () => {
  it("stays a details, closed by default, with its testid", async () => {
    render(el(SettingsPanel));
    const adv = (await screen.findByTestId("advanced")) as HTMLDetailsElement;
    expect(adv.tagName).toBe("DETAILS");
    expect(adv.open).toBe(false);
  });
});
