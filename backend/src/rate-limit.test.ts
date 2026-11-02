/*
 * Which bucket a request lands in — the topology written down as a test.
 *
 * In production a request reaches this process as
 *
 *     client ──▶ Traefik ──▶ nginx ──▶ Express
 *
 * so the socket is nginx's, and X-Forwarded-For arrives as "<client>, <traefik>":
 * Traefik wrote the client, nginx's `$proxy_add_x_forwarded_for` appended
 * Traefik. supertest's socket is loopback, which stands in for nginx here, and
 * the header is written exactly as nginx would hand it on.
 *
 * The limiter used is the mail burst limiter (40 per 15 minutes on /api/email),
 * driven with an empty body: validation answers 400 without touching SMTP, and
 * the burst limiter counts failures where the send limiter deliberately skips
 * them. Each test builds its own app, so each starts with empty buckets.
 *
 * Every assertion here failed with `trust proxy` at 1 (#121): req.ip was the
 * Traefik address for everybody, so two visitors shared one bucket.
 */
import request from "supertest";
import { createApp } from "./app";

const TRAEFIK = "10.42.0.17"; // a k3s pod address; the same one for every visitor
const BURST_LIMIT = 40;

function send(app: ReturnType<typeof createApp>, forwardedFor: string) {
  return request(app).post("/api/email/send").set("X-Forwarded-For", forwardedFor).send({});
}

async function exhaust(app: ReturnType<typeof createApp>, forwardedFor: string) {
  for (let i = 0; i < BURST_LIMIT; i++) {
    const res = await send(app, forwardedFor);
    // A 429 before the limit is reached means the bucket was already shared.
    expect(res.status).toBe(400);
  }
  expect((await send(app, forwardedFor)).status).toBe(429);
}

describe("rate-limit keying behind Traefik and nginx", () => {
  it("gives each client its own bucket, not one for everyone behind the proxy", async () => {
    const app = createApp();
    await exhaust(app, `203.0.113.7, ${TRAEFIK}`);

    // A different visitor, through the same Traefik pod, is unaffected.
    expect((await send(app, `198.51.100.9, ${TRAEFIK}`)).status).toBe(400);
  });

  it("cannot be escaped by writing a fresh address into X-Forwarded-For", async () => {
    const app = createApp();
    await exhaust(app, `203.0.113.7, ${TRAEFIK}`);

    // Whatever the client sends lands to the left of the address Traefik
    // appended, and with a hop count Express never reads that far. Were this
    // `trust proxy: true`, each of these would be a brand-new bucket.
    for (const spoof of ["192.0.2.1", "192.0.2.2", "192.0.2.3"]) {
      expect((await send(app, `${spoof}, 203.0.113.7, ${TRAEFIK}`)).status).toBe(429);
    }
  });
});
