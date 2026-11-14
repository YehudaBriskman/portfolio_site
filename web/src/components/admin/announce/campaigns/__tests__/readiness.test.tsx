import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import ReadinessCard from "../../sender/ReadinessCard";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
let reply: () => Response;
beforeEach(() => vi.stubGlobal("fetch", vi.fn(async () => reply())));
afterEach(() => (cleanup(), vi.unstubAllGlobals()));

describe("the readiness card", () => {
  it("names what to fix, in words, and never shows unknown as a failure", async () => {
    reply = () => json({ ok: true, domain: "example.org", replyTo: false, items: [
      { id: "spf", status: "ok" }, { id: "dkim", status: "unknown" }, { id: "dmarc", status: "fix" }, { id: "replyTo", status: "fix" },
    ] });
    render(<ReadinessCard />);
    expect((await screen.findByTestId("readiness-domain")).textContent).toContain("example.org");
    expect(screen.getByTestId("ready-spf").dataset.status).toBe("ok");
    expect(screen.getByTestId("ready-dmarc").textContent).toContain("_dmarc.example.org");
    const dkim = screen.getByTestId("ready-dkim");
    expect(dkim.textContent).toContain("Not sure");
    expect(dkim.textContent).not.toContain("Fix");
    expect(screen.getByTestId("ready-replyTo").textContent).toContain("Set a Reply-To");
  });
  it("says so when the checklist cannot be read", async () => {
    reply = () => json({ ok: false }, 500);
    render(<ReadinessCard />);
    expect(await screen.findByRole("alert")).toBeTruthy();
  });
});
