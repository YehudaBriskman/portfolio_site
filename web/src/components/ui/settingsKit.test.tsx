import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Bell, Mail, Gauge as GaugeIcon } from "lucide-react";
import { Switch } from "@/components/ui/Switch";
import { InfoPopover } from "@/components/ui/InfoPopover";
import { SettingsRow } from "@/components/ui/SettingsRow";
import { SettingsList, type SettingsGroupDef } from "@/components/ui/SettingsList";
import { SettingsSearch } from "@/components/ui/SettingsSearch";
import { firstSentence, groupSurface, matchItems } from "@/components/ui/settingsKit";

const css = (name: string) => readFileSync(resolve(__dirname, name), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

const realMatchMedia = window.matchMedia;

beforeEach(() => {
  Object.assign(HTMLDialogElement.prototype, {
    showModal: vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    }),
    close: vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    }),
  });
});
afterEach(() => {
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
  document.documentElement.removeAttribute("lang");
  document.documentElement.removeAttribute("dir");
  window.matchMedia = realMatchMedia;
  vi.restoreAllMocks();
});

const LONG = "Send a confirmation email first. Nobody is added until they click it. This protects the list.";

/* ------------------------------------------------------------- Switch */

describe("Switch", () => {
  function Host({ hint }: { hint?: string }) {
    const [on, setOn] = useState(false);
    return <Switch label="Double opt-in" hint={hint} checked={on} onChange={setOn} />;
  }

  it("is a role=switch with aria-checked following the state", () => {
    render(<Host />);
    const sw = screen.getByRole("switch", { name: "Double opt-in" });
    expect(sw.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(sw);
    expect(sw.getAttribute("aria-checked")).toBe("true");
  });

  it("toggles with Space and by pressing its label text", async () => {
    const user = userEvent.setup();
    render(<Host />);
    const sw = screen.getByRole("switch");
    await user.tab();
    expect(document.activeElement).toBe(sw);
    await user.keyboard(" ");
    expect(sw.getAttribute("aria-checked")).toBe("true");
    await user.click(screen.getByText("Double opt-in"));
    expect(sw.getAttribute("aria-checked")).toBe("false");
  });

  it("reports the new value, and does nothing when disabled", () => {
    const onChange = vi.fn();
    const { rerender } = render(<Switch label="A" checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
    rerender(<Switch label="A" checked={false} onChange={onChange} disabled />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("describes itself with its one-line hint", () => {
    render(<Host hint="Ask before adding" />);
    const sw = screen.getByRole("switch");
    expect(document.getElementById(sw.getAttribute("aria-describedby")!)?.textContent).toBe("Ask before adding");
  });

  it("has a 44px row, a one-line label and logical, reduced-motion-safe CSS", () => {
    const c = css("Switch.module.css");
    expect(c).toMatch(/min-block-size:\s*(2\.75rem|44px)/);
    expect(c).toMatch(/white-space:\s*nowrap/);
    expect(c).not.toMatch(/\b(left|right|margin-left|margin-right|padding-left|padding-right)\s*:/);
    const noPref = c.indexOf("prefers-reduced-motion: no-preference");
    expect(noPref).toBeGreaterThan(-1);
    expect(c.slice(0, noPref)).not.toMatch(/transition\s*:/);
  });
});

/* ------------------------------------------------------- InfoPopover */

describe("InfoPopover", () => {
  it("keeps the help out of the DOM until the button is pressed", async () => {
    render(<InfoPopover label="Double opt-in" text={LONG} />);
    expect(screen.queryByText(LONG)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "About Double opt-in" }));
    expect(await screen.findByText(LONG)).toBeTruthy();
  });

  it("closes on Escape and returns focus to the button", async () => {
    const user = userEvent.setup();
    render(<InfoPopover label="Double opt-in" text={LONG} />);
    const btn = screen.getByRole("button", { name: "About Double opt-in" });
    await user.click(btn);
    await screen.findByText(LONG);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByText(LONG)).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(btn));
  });

  it("lives inside a modal dialog when opened from one, so the top layer cannot hide it", async () => {
    const { container } = render(
      <dialog open>
        <InfoPopover label="X" text={LONG} />
      </dialog>,
    );
    fireEvent.click(screen.getByRole("button", { name: "About X" }));
    const text = await screen.findByText(LONG);
    expect(container.querySelector("dialog")?.contains(text)).toBe(true);
  });

  it("opens from the keyboard", async () => {
    const user = userEvent.setup();
    render(<InfoPopover label="X" text={LONG} />);
    await user.tab();
    await user.keyboard("{Enter}");
    expect(await screen.findByText(LONG)).toBeTruthy();
  });

  it("names the button in Hebrew on a Hebrew page and is a 44px target", () => {
    document.documentElement.lang = "he";
    render(<InfoPopover label="אישור כפול" text="טקסט" />);
    expect(screen.getByRole("button", { name: "על אישור כפול" })).toBeTruthy();
    expect(css("InfoPopover.module.css")).toMatch(/(inline|block)-size:\s*(2\.75rem|44px)/);
  });
});

/* ------------------------------------------------------- SettingsRow */

describe("SettingsRow", () => {
  it("a switch row is one-line, titled, with a separate info button", () => {
    const { container } = render(
      <SettingsRow id="doi" kind="switch" label="Double opt-in" checked onChange={() => {}} info={LONG} />,
    );
    const label = container.querySelector("[data-sw-label]") as HTMLElement;
    expect(label.getAttribute("title")).toBe("Double opt-in");
    const sw = screen.getByRole("switch");
    const info = screen.getByRole("button", { name: "About Double opt-in" });
    expect(sw.contains(info) || info.contains(sw)).toBe(false);
    expect(container.querySelector("label")?.contains(info)).toBe(false);
    expect(screen.queryByText(LONG)).toBeNull();
  });

  it("exposes the first sentence of the help as the switch's description", () => {
    render(<SettingsRow id="doi" kind="switch" label="Double opt-in" checked={false} onChange={() => {}} info={LONG} />);
    const sw = screen.getByRole("switch");
    const desc = document.getElementById(sw.getAttribute("aria-describedby")!);
    expect(desc?.textContent).toBe("Send a confirmation email first.");
    expect(firstSentence(LONG)).toBe("Send a confirmation email first.");
  });

  it("shows a warning always, with a role, and no paragraph without one", () => {
    const { container, rerender } = render(
      <SettingsRow id="e" kind="switch" label="Email" checked onChange={() => {}} warning="No sender address" />,
    );
    expect(screen.getByRole("alert").textContent).toContain("No sender address");
    rerender(<SettingsRow id="e" kind="switch" label="Email" checked onChange={() => {}} />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(container.querySelector("p")).toBeNull();
  });

  it("a value row is one button that shows the current value and a chevron", () => {
    const onOpen = vi.fn();
    const { container } = render(<SettingsRow id="cap" kind="value" label="Daily cap" valueText="500" onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: /Daily cap/ }));
    expect(onOpen).toHaveBeenCalled();
    expect(container.querySelector("[data-sr-chevron]")).toBeTruthy();
    expect(screen.getByText("500")).toBeTruthy();
  });

  it("never renders a checkbox without role=switch", () => {
    const { container } = render(<SettingsRow id="a" kind="switch" label="A" checked onChange={() => {}} />);
    for (const box of container.querySelectorAll('input[type="checkbox"]')) expect(box.getAttribute("role")).toBe("switch");
  });
});

/* ------------------------------------------------------ SettingsSearch */

describe("SettingsSearch + matching", () => {
  const items = [
    { id: "doi", label: "Double opt-in", info: "Ask people to confirm" },
    { id: "cap", label: "Daily cap", info: "How many emails per day" },
  ];

  it("matches label and help text, ignoring case, and returns everything for an empty query", () => {
    expect(matchItems(items, "OPT").map((i) => i.id)).toEqual(["doi"]);
    expect(matchItems(items, "per day").map((i) => i.id)).toEqual(["cap"]);
    expect(matchItems(items, "  ").length).toBe(2);
    expect(matchItems(items, "zzz")).toEqual([]);
  });

  it("is a search field with a 16px font, a status count and a Clear button on no results", () => {
    const onChange = vi.fn();
    render(<SettingsSearch value="zzz" onChange={onChange} count={0} />);
    const field = screen.getByRole("searchbox", { name: "Search settings" });
    expect(field.getAttribute("enterkeyhint")).toBe("search");
    expect(css("SettingsSearch.module.css")).toMatch(/font-size:\s*(1rem|16px)/);
    expect(screen.getByRole("status").textContent).toContain("No settings match");
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("announces the count, in Hebrew too", () => {
    const { rerender } = render(<SettingsSearch value="a" onChange={() => {}} count={2} />);
    expect(screen.getByRole("status").textContent).toBe("2 settings found");
    document.documentElement.lang = "he";
    rerender(<SettingsSearch value="a" onChange={() => {}} count={2} />);
    expect(screen.getByRole("status").textContent).toBe("נמצאו 2 הגדרות");
    expect(screen.getByRole("searchbox", { name: "חיפוש בהגדרות" })).toBeTruthy();
  });
});

/* -------------------------------------------------------- SettingsList */

type Doc = { email: boolean; alerts: number; doi: boolean; cap: number; a: boolean; b: boolean; c: boolean; d: boolean; e: boolean };
const base: Doc = { email: true, alerts: 2, doi: false, cap: 500, a: false, b: false, c: false, d: false, e: false };

function groups(set: (p: Partial<Doc>) => void): SettingsGroupDef<Doc>[] {
  return [
    {
      id: "everyday", icon: Bell, title: "Everyday", controls: 2,
      items: [
        { id: "email", label: "Email", info: "Send newsletters by email" },
        { id: "doi", label: "Double opt-in", info: LONG },
      ],
      summary: (d) => `Email ${d.email ? "on" : "off"} · ${d.alerts} alerts`,
      warning: (d) => (d.email ? null : "Email is off"),
      render: (d) => (
        <>
          <SettingsRow id="email" kind="switch" label="Email" checked={d.email} onChange={(v) => set({ email: v })} info="Send newsletters by email" />
          <SettingsRow id="doi" kind="switch" label="Double opt-in" checked={d.doi} onChange={(v) => set({ doi: v })} info={LONG} />
        </>
      ),
    },
    {
      id: "channels", icon: Mail, title: "Channels", controls: 5,
      items: [{ id: "a", label: "LinkedIn" }, { id: "b", label: "Instagram" }],
      summary: (d) => `${[d.a, d.b, d.c, d.d, d.e].filter(Boolean).length} of 5 channels`,
      render: (d) => (
        <>
          {(["a", "b", "c", "d", "e"] as const).map((k) => (
            <SettingsRow key={k} id={k} kind="switch" label={k === "a" ? "LinkedIn" : k === "b" ? "Instagram" : `Channel ${k}`} checked={d[k]} onChange={(v) => set({ [k]: v })} />
          ))}
        </>
      ),
    },
    {
      id: "limits", icon: GaugeIcon, title: "Limits", controls: 1, hasText: true,
      items: [{ id: "cap", label: "Daily cap", info: "How many emails per day" }],
      summary: (d) => `${d.cap} / day`,
      render: () => <label>Cap <input aria-label="Cap" defaultValue="500" /></label>,
    },
  ];
}

function stubWide() {
  window.matchMedia = ((q: string) => ({
    matches: q.includes("840"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

function Host({ initialOpen = null as string | null }) {
  const [doc, setDoc] = useState(base);
  const [open, setOpen] = useState<string | null>(initialOpen);
  return <SettingsList groups={groups((p) => setDoc((d) => ({ ...d, ...p })))} value={doc} openId={open} onOpenChange={setOpen} />;
}

describe("SettingsList", () => {
  it("shows icon, name, a one-line summary and a chevron per group, and no help paragraph", () => {
    const { container } = render(<Host />);
    const rows = container.querySelectorAll("[data-settings-group]");
    expect(rows.length).toBe(3);
    const first = rows[0] as HTMLElement;
    expect(within(first).getByText("Everyday")).toBeTruthy();
    expect(within(first).getByText("Email on · 2 alerts")).toBeTruthy();
    expect(first.querySelector("[data-sr-chevron]")).toBeTruthy();
    expect(first.querySelector("svg")).toBeTruthy();
    expect(container.querySelector("p, .a-hint")).toBeNull();
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
  });

  it("the summary follows the values as a switch flips (and only that summary is live)", () => {
    const { container } = render(<Host initialOpen="everyday" />);
    fireEvent.click(screen.getByRole("switch", { name: "Email" }));
    const summary = container.querySelector('[data-settings-group="everyday"] [data-sg-summary]') as HTMLElement;
    expect(summary.textContent).toBe("Email off · 2 alerts");
    expect(summary.getAttribute("aria-live")).toBe("polite");
  });

  it("shows a group warning on its row only when something is wrong", () => {
    render(<Host initialOpen="everyday" />);
    const row = () => document.querySelector('[data-settings-group="everyday"]') as HTMLElement;
    expect(within(row()).queryByRole("alert")).toBeNull();
    fireEvent.click(screen.getByRole("switch", { name: "Email" }));
    expect(within(row()).getByRole("alert").textContent).toContain("Email is off");
  });

  it("opens a small group (<= 4 switches) as a half sheet", () => {
    const { container } = render(<Host />);
    fireEvent.click(container.querySelector('[data-settings-group="everyday"] button')!);
    const dlg = container.querySelector("dialog") as HTMLDialogElement;
    expect(dlg.getAttribute("data-snap")).toBe("half");
    expect(dlg.querySelector("[data-surface]")?.getAttribute("data-surface")).toBe("sheet");
    expect(within(dlg).getByRole("switch", { name: "Double opt-in" })).toBeTruthy();
  });

  it("opens a bigger group, or one with a text field, as a sub-page with a back link", () => {
    expect(groupSurface({ controls: 5 })).toBe("page");
    expect(groupSurface({ controls: 1, hasText: true })).toBe("page");
    expect(groupSurface({ controls: 4 })).toBe("sheet");
    const { container } = render(<Host />);
    fireEvent.click(container.querySelector('[data-settings-group="channels"] button')!);
    expect(container.querySelector("dialog")).toBeNull();
    const page = container.querySelector('[data-surface="page"]') as HTMLElement;
    expect(within(page).getByRole("heading", { name: "Channels" })).toBeTruthy();
    /* The list stays mounted under the page, covered and inert, so the page can push over it and pop back. */
    expect(container.querySelector("[data-covered]")!.hasAttribute("inert")).toBe(true);
    expect(page.getAttribute("data-open")).toBe("true");
    fireEvent.click(within(page).getByRole("button", { name: "Back to settings" }));
    expect(container.querySelector('[data-surface="page"]')).toBeNull();
    expect(container.querySelector("[data-covered]")).toBeNull();
    expect(container.querySelectorAll("[data-settings-group]").length).toBe(3);
  });

  it("reports the open group through onOpenChange (so a URL can hold it)", () => {
    const onOpenChange = vi.fn();
    const { container } = render(
      <SettingsList groups={groups(() => {})} value={base} openId={null} onOpenChange={onOpenChange} />,
    );
    fireEvent.click(container.querySelector('[data-settings-group="limits"] button')!);
    expect(onOpenChange).toHaveBeenCalledWith("limits");
  });

  it("filters rows by label or help, shows Group > Label, and opens the group focused on the row", async () => {
    const { container } = render(<Host />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "opt" } });
    expect(container.querySelectorAll("[data-settings-group]").length).toBe(0);
    const hit = container.querySelector("[data-search-hit]") as HTMLElement;
    expect(hit.textContent).toContain("Everyday");
    expect(hit.textContent).toContain("Double opt-in");
    expect(container.querySelectorAll("[data-search-hit]").length).toBe(1);
    expect(screen.getByRole("status").textContent).toBe("1 setting found");
    fireEvent.click(hit);
    const sw = await screen.findByRole("switch", { name: "Double opt-in" });
    await waitFor(() => expect(document.activeElement).toBe(sw));
  });

  it("matches help text too, and an empty result offers Clear search", () => {
    render(<Host />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "per day" } });
    expect(document.querySelectorAll("[data-search-hit]").length).toBe(1);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "nothing like this" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(document.querySelectorAll("[data-settings-group]").length).toBe(3);
  });

  it("at 840px and up shows the list and the open group side by side, no sheet", () => {
    stubWide();
    const { container } = render(<Host initialOpen="everyday" />);
    expect(container.querySelector("[data-panes]")).toBeTruthy();
    expect(container.querySelector("dialog")).toBeNull();
    expect(container.querySelectorAll("[data-settings-group]").length).toBe(3);
    expect(screen.getByRole("switch", { name: "Email" })).toBeTruthy();
  });

  it("renders in Hebrew with logical CSS and a chevron that mirrors", () => {
    document.documentElement.lang = "he";
    document.documentElement.dir = "rtl";
    render(<Host />);
    expect(screen.getByRole("searchbox", { name: "חיפוש בהגדרות" })).toBeTruthy();
    const c = css("SettingsList.module.css") + css("SettingsRow.module.css");
    expect(c).toMatch(/:dir\(rtl\)[^{]*\{[^}]*scaleX\(-1\)/);
    expect(c).not.toMatch(/\b(left|right|margin-left|margin-right|padding-left|padding-right)\s*:/);
    expect(c).toMatch(/min-block-size:\s*(3\.5rem|56px)/);
  });
});
