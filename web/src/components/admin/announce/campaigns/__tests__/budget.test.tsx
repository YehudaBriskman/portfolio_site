import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import BudgetMeter from "../../sender/BudgetMeter";
import BudgetPlan from "../BudgetPlan";
import SenderSection from "../../sender/SenderSection";
import { DEFAULT_SENDER, senderProblems } from "../../sender/defaults";
import { useBudgetWords } from "../../sender/budgetWords";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const view = (o: object = {}) => ({
  ok: true, limits: {}, today: { used: 30, usable: 81, reserve: 17, room: 34 }, month: { used: 400, usable: 2430, room: 2000 }, capacity: 34, waiting: null, resumeAt: null, thresholds: [], ...o,
});
let reply: (url: string) => Response;
beforeEach(() => {
  reply = () => json(view());
  vi.stubGlobal("fetch", vi.fn(async (url: string) => reply(url)));
});
afterEach(() => (cleanup(), vi.unstubAllGlobals(), document.documentElement.removeAttribute("lang")));

describe("the budget meter", () => {
  it("shows today and the month from the server's counts, and what campaigns may still send", async () => {
    render(<BudgetMeter />);
    expect(await screen.findByTestId("budget-meter")).toBeTruthy();
    expect(screen.getByText("30 of 81")).toBeTruthy();
    expect(screen.getByText("400 of 2,430")).toBeTruthy();
    expect(screen.getByText("17 kept for confirmations and contact mail")).toBeTruthy();
    expect(screen.getByTestId("budget-room").textContent).toBe("Campaigns can send 34 more right now.");
    expect(screen.getAllByRole("progressbar")).toHaveLength(2);
    expect(screen.queryByTestId("budget-threshold")).toBeNull();
  });

  it("names the threshold reached, the higher one first", async () => {
    reply = () => json(view({ thresholds: [70, 90] }));
    render(<BudgetMeter />);
    expect((await screen.findByTestId("budget-threshold")).textContent).toBe("90% of this month's budget is used.");
  });

  it("says when campaigns wait and until about when", async () => {
    reply = () => json(view({ capacity: 0, waiting: "day", resumeAt: "2026-11-14T08:00:00.000Z" }));
    render(<BudgetMeter />);
    expect((await screen.findByTestId("budget-room")).textContent).toMatch(/^The daily budget is used\. Campaigns carry on about .*2026/);
  });

  it("an unreadable answer is an error line, not a crash", async () => {
    reply = () => json({ ok: true });
    render(<BudgetMeter />);
    expect((await screen.findByRole("alert")).textContent).toContain("could not be read");
  });
});

describe("the plan line", () => {
  it("fits today", async () => {
    reply = () => json(view({ plan: { days: 1, finishAt: "2026-11-13T10:00:00.000Z" } }));
    render(<BudgetPlan remaining={20} />);
    expect((await screen.findByTestId("budget-plan")).textContent).toBe("Fits in today's mail budget.");
  });

  it("needs N days, finishing about a date, and asks the server for that many people", async () => {
    reply = () => json(view({ plan: { days: 5, finishAt: "2026-11-17T10:00:00.000Z" } }));
    render(<BudgetPlan remaining={300} />);
    await waitFor(() => expect(screen.getByTestId("budget-plan").textContent).toMatch(/^Needs 5 days, finishing about .*2026\.$/));
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe("/api/admin/campaigns/budget?remaining=300");
  });

  it("waits when today is used up, and says when the settings leave no room", async () => {
    reply = () => json(view({ capacity: 0, waiting: "day", plan: { days: 1, finishAt: "2026-11-14T10:00:00.000Z" } }));
    const { unmount } = render(<BudgetPlan remaining={10} />);
    expect((await screen.findByTestId("budget-plan")).textContent).toMatch(/^Waits for the mail budget\./);
    unmount();
    reply = () => json(view({ plan: null }));
    render(<BudgetPlan remaining={10} />);
    expect((await screen.findByTestId("budget-plan")).textContent).toContain("leaves no room");
  });

  it("says nothing when there is nobody left", () => {
    render(<BudgetPlan remaining={0} />);
    expect(screen.queryByTestId("budget-plan")).toBeNull();
  });
});

describe("the settings fields", () => {
  it("are validated like the server: whole limits, a monthly limit not below the daily one, ratios in range", () => {
    expect(senderProblems(DEFAULT_SENDER)).toEqual({});
    const p = senderProblems({ ...DEFAULT_SENDER, dailyLimit: 0, monthlyLimit: 50, safety: 1.5, reserveShare: 0.9 });
    expect(p).toMatchObject({ dailyLimit: "number", safety: "number", reserveShare: "number" });
    expect(senderProblems({ ...DEFAULT_SENDER, dailyLimit: 100, monthlyLimit: 50 }).monthlyLimit).toBe("monthBelowDay");
  });

  it("render in Settings with the percent form of the ratios", async () => {
    render(<SenderSection sender={DEFAULT_SENDER} onChange={() => {}} warnings={[]} />);
    expect((await screen.findByLabelText("Provider limit per day") as HTMLInputElement).value).toBe("90");
    expect((screen.getByLabelText("Provider limit per month") as HTMLInputElement).value).toBe("2700");
    expect((screen.getByLabelText("Safety factor (%)") as HTMLInputElement).value).toBe("90");
    expect((screen.getByLabelText("Share of the day kept for confirmations (%)") as HTMLInputElement).value).toBe("20");
  });
});

describe("Hebrew", () => {
  it("has every key", () => {
    const { en, he } = useBudgetWords.table;
    expect(Object.keys(he).sort()).toEqual(Object.keys(en).sort());
  });
});
