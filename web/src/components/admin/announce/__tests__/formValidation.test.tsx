import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DEFAULT_SENDER, senderProblems } from "../sender/defaults";
import AddContact from "../audience/AddContact";
import ContactEditor from "../audience/ContactEditor";
import SettingsPanel from "../SettingsPanel";
import { DEFAULT_NOTIFY } from "../notify/defaults";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const sender = (o: object = {}) => ({ ...DEFAULT_SENDER, footerIdentity: "Yehuda, Tel Aviv", identityEmail: "me@example.com", testRecipients: ["me@example.com"], ...o });

afterEach(() => (cleanup(), vi.unstubAllGlobals()));

describe("sender form names what the server would refuse", () => {
  it("B8 fromName with a double quote", () => {
    expect(senderProblems(sender({ fromName: 'Yehuda "Y"' })).fromName).toBeDefined();
  });
  it("B9 a blank quiet-hours time", () => {
    expect(senderProblems(sender({ quietHours: { from: "", to: "07:00", tz: "Asia/Jerusalem" } })).quietHours).toBeDefined();
  });
  it("B10 an address the server's email() refuses", () => {
    expect(senderProblems(sender({ replyTo: "me@example.c" })).replyTo).toBeDefined();
    expect(senderProblems(sender({ testRecipients: ["a..b@example.com"] })).testRecipients).toBeDefined();
  });
});

describe("contact name inputs", () => {
  it("B15 cap at the server's 80 characters", () => {
    render(<AddContact groups={[]} onClose={() => {}} onDone={() => {}} />);
    expect(document.querySelector("input[maxlength='120']")).toBeNull();
    expect(document.querySelector("input[maxlength='80']")).not.toBeNull();
    cleanup();
    const c = { hash: "h", email: "a@example.com", name: "A", lang: "en", groups: [], status: "active", source: "manual", consentAt: "2026-01-01T00:00:00Z", consentNote: "x", topics: { blog: true, releases: true } } as never;
    render(<ContactEditor contact={c} groups={[]} onClose={() => {}} onDone={() => {}} />);
    expect(document.querySelector("input[maxlength='120']")).toBeNull();
    expect(document.querySelector("input[maxlength='80']")).not.toBeNull();
  });
});

describe("settings hashtags", () => {
  it("B6 a hashtag the server refuses disables Save and says why in plain words", async () => {
    const settings = { enabled: true, email: { enabled: false, events: [] }, hashtags: [], signature: "", channels: ["linkedin"], templates: { en: {}, he: {} }, snippets: [], library: [], advanced: { utm: { enabled: false, source: "announce", mediumByChannel: {} } }, sender: sender(), notify: DEFAULT_NOTIFY };
    vi.stubGlobal("fetch", vi.fn(async () => json({ ok: true, exists: true, _rev: "1-s", updatedAt: null, settings })));
    render(<MemoryRouter><SettingsPanel /></MemoryRouter>);
    fireEvent.change(await screen.findByLabelText("Default hashtags"), { target: { value: "#build-in-public" } });
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/letters, digits/i)).toBeTruthy();
  });
});
