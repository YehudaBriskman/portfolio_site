import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_ANNOUNCE_SETTINGS } from "../announce/schemas.js";

const purge = vi.fn(async () => 0);
const expired = { _id: "contact:" + "a".repeat(32), type: "contact", email: "a@example.org", lang: "en", groups: [], status: "pending", updatedAt: "2000-01-01T00:00:00.000Z" };

vi.mock("../announce/store.js", () => ({ loadSettings: async () => DEFAULT_ANNUAL() }));
vi.mock("./tokens.js", () => ({ verifyToken: async () => ({ t: "confirm", h: "a".repeat(32), exp: 9e9 }) }));
vi.mock("./store.js", async (orig) => ({
  ...(await orig<typeof import("./store.js")>()),
  getContact: async () => expired,
  purgeExpiredPending: (...a: unknown[]) => purge(...(a as [])),
}));
function DEFAULT_ANNUAL() {
  return DEFAULT_ANNOUNCE_SETTINGS;
}

import router from "./public.route.js";

describe("confirm with an expired pending signup", () => {
  it("answers as a bad link and does not force the cleanup scan", async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/subscribe", router);
    const r = await request(app).post("/api/subscribe/confirm").send({ token: "x".repeat(20) });
    expect(r.status).toBe(400);
    expect(purge).toHaveBeenCalled();
    for (const call of purge.mock.calls as unknown[][]) expect(call).toHaveLength(0);
  });
});
