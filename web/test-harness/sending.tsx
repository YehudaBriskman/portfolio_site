/* eslint-disable react-refresh/only-export-components -- entry file, never hot-reloaded */
import { createRoot } from "react-dom/client";
import "@/index.css";
import "@/styles/popup.css";
import BudgetMeter from "@/components/admin/announce/sender/BudgetMeter";
import CampaignEditor from "@/components/admin/announce/campaigns/CampaignEditor";
import { DEFAULT_SENDER } from "@/components/admin/announce/sender/defaults";

/*
 * ?scene=warmup | paused | readiness | advice, ?state=<variant>, ?dir=rtl, ?theme=dark.
 * The API is a canned fetch, so the real components render real words.
 */
const p = new URLSearchParams(location.search);
const rtl = p.get("dir") === "rtl";
const scene = p.get("scene") ?? "warmup";
const state = p.get("state") ?? "";
document.documentElement.dir = rtl ? "rtl" : "ltr";
document.documentElement.lang = rtl ? "he" : "en";
document.documentElement.setAttribute("data-theme", p.get("theme") === "dark" ? "dark" : "light");

const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { "Content-Type": "application/json" } });
const camp = (o: object) => ({
  id: "c1", _rev: "1-a", name: "Spring news", subject: "Three new posts", preheader: "", bodyText: "Hi there", blocks: null, groups: ["subscribers"], lang: "all", topic: null,
  status: "draft", sendAt: null, counters: { queued: 0, sent: 0, failed: 0, suppressed: 0 }, eventId: null, pausedReason: null, startedAt: null, finishedAt: null,
  createdAt: "2026-11-01T10:00:00Z", updatedAt: "2026-11-01T10:00:00Z", ...o,
});
const budget = { ok: true, limits: {}, today: { used: 12, usable: 20, reserve: 4, room: 4 }, month: { used: 40, usable: 2430, room: 2390 }, capacity: 4, waiting: null, resumeAt: null, thresholds: [], warmup: { day: 3, daily: 20, hourly: 10 } };
const readiness: Record<string, unknown> = {
  mixed: { ok: true, domain: "yehudabriskman.com", replyTo: false, items: [
    { id: "spf", status: "ok" }, { id: "dkim", status: "unknown" }, { id: "dmarc", status: "fix" }, { id: "domainMatch", status: "ok" },
    { id: "replyTo", status: "fix" }, { id: "identity", status: "ok" }, { id: "testRecipient", status: "ok" }, { id: "webhook", status: "fix" },
  ] },
  pass: { ok: true, domain: "yehudabriskman.com", replyTo: true, items: ["spf", "dkim", "dmarc", "domainMatch", "replyTo", "identity", "testRecipient", "webhook"].map((id) => ({ id, status: "ok" })) },
};
const stored = scene === "paused"
  ? camp({ status: "paused", pausedReason: "complaint", counters: { queued: 40, sent: 12, failed: 0, suppressed: 0 }, startedAt: "2026-11-14T08:00:00Z" })
  : camp(state === "ok" ? {} : { subject: "BIG NEWS!! Re: three new posts that you will not want to miss at all today", bodyText: "Read https://bit.ly/abc and http://example.org/x" });

window.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url.startsWith("/api/admin/campaigns/readiness")) return json(readiness[state] ?? readiness.mixed);
  if (url.startsWith("/api/admin/campaigns/budget")) return json(budget);
  if (url === "/api/admin/campaigns/c1") return json({ ok: true, campaign: stored });
  if (url.startsWith("/api/admin/campaigns/audience")) return json({ ok: true, count: 12, samples: [] });
  if (url.startsWith("/api/admin/campaigns/sending")) return json({ ok: true, paused: false, pausedAt: null, envDisabled: false, blocked: false });
  if (url.startsWith("/api/admin/campaigns/preview")) return json({ ok: true, subject: "x", html: "<p>Hi</p>", text: "Hi" });
  return json({ ok: true });
}) as typeof fetch;

async function mount() {
  const root = createRoot(document.getElementById("root")!);
  /* Only the branch that has the card has the file. */
  const found = Object.values(import.meta.glob("/src/components/admin/announce/sender/ReadinessCard.tsx"))[0];
  const ReadinessCard = found ? ((await found()) as { default: () => JSX.Element }).default : null;
  root.render(
    <div className="mx-auto max-w-md space-y-4 p-4">
      {scene === "warmup" && <BudgetMeter phone />}
      {scene === "readiness" && ReadinessCard && <ReadinessCard />}
      {(scene === "paused" || scene === "advice") && (
        <CampaignEditor id="c1" sender={{ ...DEFAULT_SENDER, footerIdentity: "Yehuda, Tel Aviv", identityEmail: "me@example.com", testRecipients: ["me@example.com"] }} groups={[{ slug: "subscribers", name: "Subscribers", kind: "system", total: 12, active: 12 } as never]} events={[]} onClose={() => {}} onChanged={() => {}} />
      )}
    </div>,
  );
}
void mount();
