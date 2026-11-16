import pino from "pino";
import { Writable } from "node:stream";
import { logOptions } from "./logger.js";

function capture(obj: Record<string, unknown>): string {
  let out = "";
  const sink = new Writable({
    write(c, _e, cb) {
      out += c.toString();
      cb();
    },
  });
  pino({ ...logOptions("info") }, sink).info(obj, "line");
  return out;
}

describe("log redaction", () => {
  it.each([
    ["request headers", { req: { headers: { authorization: "Bearer SECRETVALUE", cookie: "sid=SECRETVALUE", "x-admin-proxy-secret": "SECRETVALUE" } } }],
    ["response headers", { res: { headers: { "set-cookie": ["sid=SECRETVALUE"] } } }],
    ["a bare headers object", { headers: { authorization: "SECRETVALUE", cookie: "SECRETVALUE" } }],
    ["top-level fields", { authorization: "SECRETVALUE", cookie: "SECRETVALUE", token: "SECRETVALUE", email: "SECRETVALUE@example.invalid", password: "SECRETVALUE" }],
    ["one level down", { body: { token: "SECRETVALUE", email: "SECRETVALUE@example.invalid", refresh_token: "SECRETVALUE", access_token: "SECRETVALUE" } }],
    ["a contact", { contact: { email: "SECRETVALUE@example.invalid" } }],
  ])("hides secrets in %s", (_n, obj) => {
    const line = capture(obj);
    expect(line).not.toContain("SECRETVALUE");
    expect(line).toContain("[redacted]");
  });

  it("leaves ordinary fields alone", () => {
    const line = capture({ route: "/api/x", status: 200 });
    expect(line).toContain("/api/x");
    expect(line).not.toContain("redacted");
  });
});
