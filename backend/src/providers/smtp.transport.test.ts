import { afterEach, describe, expect, it, vi } from "vitest";

async function optionsFor(host: string, port: number, secure?: "true" | "false") {
  vi.resetModules();
  process.env.EMAIL_PROVIDER = "smtp";
  process.env.SMTP_HOST = host;
  process.env.SMTP_PORT = String(port);
  if (secure) process.env.SMTP_SECURE = secure; else delete process.env.SMTP_SECURE;
  process.env.SMTP_USER = "u";
  process.env.SMTP_PASS = "p";
  const { transportOptions } = await import("./smtp.provider.js");
  return transportOptions();
}

afterEach(() => vi.resetModules());

describe("smtp transport options", () => {
  it("requires STARTTLS on a submission port and bounds every wait", async () => {
    const o = await optionsFor("smtp.example.org", 587);
    expect(o).toMatchObject({ requireTLS: true, secure: false, connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 60_000 });
  });
  it("port 465 is implicit TLS, no requireTLS flag needed", async () => {
    const o = await optionsFor("smtp.example.org", 465);
    expect(o.secure).toBe(true);
    expect(o).not.toHaveProperty("requireTLS");
  });
  it("a loopback test sink is the one place without TLS", async () => {
    const o = await optionsFor("127.0.0.1", 2525, "false");
    expect(o).not.toHaveProperty("requireTLS");
  });
});
