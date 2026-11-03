/*
 * The remote MCP server's pages (#263), into `docs/remote-mcp/`:
 *
 *   developers-mcp-<window>.png   /developers/mcp, the server live
 *   consent-<window>.png          the consent screen after a GitHub sign-in
 *   not-authorized-desktop.png    the page a non-owner gets (GH_LOGIN set to
 *                                 someone else in the mock; optional)
 *   connections-desktop.png       Admin → Connected apps, with sample data
 *
 * RUNNING IT
 * ----------
 * `npm run build` and `npx vite preview --host 127.0.0.1 --port 4398
 * --strictPort` for the site; a backend with MCP_REMOTE=on and its GitHub
 * URLs pointed at a mock that signs in at once (API, default
 * http://127.0.0.1:59873, whose SITE_URL is that same address); then
 * `node scripts/shoot-remote-mcp.mjs`. The page's availability probe and the
 * admin API are answered by request interception, and the consent page's
 * /fonts are served from the preview, as nginx serves them in production.
 * Waits poll by hand: headless Chromium on the dev box has almost no frame
 * clock.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] ?? resolve(HERE, "../../docs/remote-mcp");
const BASE = process.env.BASE ?? "http://127.0.0.1:4398";
const API = process.env.API ?? "http://127.0.0.1:59873";
const ONLY = process.env.ONLY;

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME || undefined,
  args: ["--no-sandbox", "--font-render-hinting=none"],
});

const WINDOWS = [
  ["desktop", 1440, 900],
  ["phone", 390, 844],
];

async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  for (let i = 0; i < 3; i += 1) {
    await page.screenshot({ timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(150);
  }
}

async function developersPage(name, width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  await page.route("**/.well-known/oauth-protected-resource/mcp", (r) =>
    r.fulfill({ json: { resource: "https://yehudabriskman.com/mcp", authorization_servers: ["https://yehudabriskman.com"] } }),
  );
  await page.goto(`${BASE}/developers/mcp`, { waitUntil: "load" });
  await page.waitForFunction(() => document.body.innerText.includes("Status: live"), null, { polling: 500, timeout: 30000 });
  await settle(page);
  await page.screenshot({ path: `${OUT}/developers-mcp-${name}.png`, fullPage: true });
  await page.close();
}

async function consentPage(name, width, height, file = "consent") {
  const reg = await fetch(`${API}/mcp/oauth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_name: "Claude Code", redirect_uris: ["http://localhost:53682/callback"], token_endpoint_auth_method: "none" }),
  }).then((r) => r.json());
  const authorize = new URL(`${API}/mcp/oauth/authorize`);
  authorize.search = new URLSearchParams({
    response_type: "code",
    client_id: reg.client_id,
    redirect_uri: "http://localhost:53682/callback",
    code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    code_challenge_method: "S256",
    state: "screenshot",
    scope: "mcp:read mcp:write",
    resource: `${API}/mcp`,
  }).toString();
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.route(`${API}/fonts/**`, (r) => r.continue({ url: r.request().url().replace(API, BASE) }));
  await page.goto(authorize.href, { waitUntil: "load" });
  await settle(page);
  await page.screenshot({ path: `${OUT}/${file}-${name}.png`, fullPage: true });
  await page.close();
}

async function connections() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const now = Date.now();
  const iso = (ms) => new Date(now - ms).toISOString();
  await page.route("**/api/admin/me", (r) => r.fulfill({ json: { ok: true, login: "YehudaBriskman", email: null } }));
  await page.route("**/api/admin/mcp/grants", (r) =>
    r.fulfill({
      json: {
        ok: true,
        items: [
          { id: "a1b2c3d4e5f60718", client: "Claude Code", scopes: ["mcp:read", "mcp:write"], login: "YehudaBriskman", createdAt: iso(3 * 86400e3), lastUsedAt: iso(20 * 60e3), expiresAt: iso(-27 * 86400e3), revokedAt: null, revokedReason: null, status: "active" },
          { id: "b1b2c3d4e5f60718", client: "claude.ai", scopes: ["mcp:read"], login: "YehudaBriskman", createdAt: iso(86400e3), lastUsedAt: iso(2 * 3600e3), expiresAt: iso(-29 * 86400e3), revokedAt: null, revokedReason: null, status: "active" },
          { id: "c1b2c3d4e5f60718", client: "MCP Inspector", scopes: ["mcp:read"], login: "YehudaBriskman", createdAt: iso(9 * 86400e3), lastUsedAt: iso(9 * 86400e3), expiresAt: iso(-21 * 86400e3), revokedAt: iso(8 * 86400e3), revokedReason: "revoked by YehudaBriskman", status: "revoked" },
        ],
      },
    }),
  );
  await page.goto(`${BASE}/admin/connections`, { waitUntil: "load" });
  await page.waitForFunction(() => document.body.innerText.includes("MCP Inspector"), null, { polling: 500, timeout: 30000 });
  await settle(page);
  await page.screenshot({ path: `${OUT}/connections-desktop.png` });
  await page.close();
}

if (ONLY === "not-authorized") {
  await consentPage("desktop", 1440, 900, "not-authorized");
} else {
  for (const [name, w, h] of WINDOWS) {
    await developersPage(name, w, h);
    await consentPage(name, w, h);
  }
  await connections();
}
await browser.close();
console.log(`shots in ${OUT}`);
