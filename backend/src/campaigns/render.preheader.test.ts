import { beforeEach, describe, expect, it, vi } from "vitest";
import { couch, CouchError } from "../db/couch.js";
import { env } from "../env.js";
import { DEFAULT_ANNOUNCE_SETTINGS } from "../announce/schemas.js";
import { renderCampaignMail } from "./render.js";

beforeEach(() => {
  (env as { SUBSCRIBE_SECRET?: string }).SUBSCRIBE_SECRET = "s".repeat(32);
  vi.spyOn(couch, "get").mockImplementation(async () => { throw new CouchError(404, "404"); });
});

const sender = { ...DEFAULT_ANNOUNCE_SETTINGS.sender, footerIdentity: "Yehuda", identityEmail: "me@example.org" };
const hidden = (html: string) => /<div style="display:none[^>]*>([^<]*)/.exec(html)?.[1] ?? "";

describe("preview line of a campaign mail", () => {
  it("uses the owner's preheader when there is one", async () => {
    const m = await renderCampaignMail({ subject: "S", preheader: "Mine", bodyText: "First paragraph." }, { lang: "en" }, "h".repeat(32), sender);
    expect(hidden(m.html)).toContain("Mine");
    expect(hidden(m.html)).not.toContain("First paragraph");
  });
  it("falls back to the first paragraph of the body when it is empty, for both languages", async () => {
    const en = await renderCampaignMail({ subject: "S", bodyText: "A new note is up.\n\nMore below." }, { lang: "en" }, "h".repeat(32), sender);
    expect(hidden(en.html)).toContain("A new note is up.");
    const he = await renderCampaignMail({ subject: "S", bodyText: "רשימה חדשה באתר.\n\nעוד למטה." }, { lang: "he" }, "h".repeat(32), sender);
    expect(hidden(he.html)).toContain("רשימה חדשה באתר.");
    expect(he.html).toMatch(/<html lang="he" dir="rtl"/);
  });
  it("the advertisement label is never the preview line, and the plain text does not change", async () => {
    const m = await renderCampaignMail({ subject: "S", bodyText: "Body." }, { lang: "he" }, "h".repeat(32), { ...sender, labelMode: "all" });
    expect(hidden(m.html)).toContain("Body.");
    expect(hidden(m.html)).not.toContain("פרסומת");
    expect(m.text).not.toContain("…");
  });
});
