import { randomBytes } from "node:crypto";
import type { Response } from "express";

/*
 * The three pages the authorization server shows a browser (#263): consent,
 * "not authorized", and an error; plus the hand-off back to the client.
 *
 * Server-rendered, no script at all, and each response carries its own CSP:
 * nothing loads but the site's own fonts and one nonce'd style block, and a
 * form can post only here. nginx adds the site-wide policy on top, and a
 * browser enforces both, so neither can be the weaker one.
 *
 * The palette and type are the site's (web/src/index.css): paper #ECE8DC,
 * ink #14130F, ink-soft #55524A, rule #CFC9BA, signal #23406B; Audiowide for
 * the display line and Atkinson Hyperlegible Next for text, both self-hosted.
 */

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const STYLE = `
@font-face{font-family:'Audiowide';font-weight:400;font-display:swap;src:url('/fonts/audiowide-400.woff2') format('woff2')}
@font-face{font-family:'Atkinson Hyperlegible Next';font-weight:400 700;font-display:swap;src:url('/fonts/atkinson-hyperlegible-next-400-700.woff2') format('woff2')}
:root{--paper:#ECE8DC;--ink:#14130F;--ink-soft:#55524A;--rule:#CFC9BA;--signal:#23406B;--panel:#0C0C0E;--danger:#8A1C1C;color-scheme:light}
*{box-sizing:border-box}
html{background:var(--paper);color:var(--ink);font:400 1.0625rem/1.6 'Atkinson Hyperlegible Next',ui-sans-serif,system-ui,sans-serif}
body{margin:0;min-height:100dvh;display:flex;flex-direction:column}
.bar{background:var(--panel);color:#F2F0EA;padding:14px 16px;font-size:.75rem;letter-spacing:.22em;text-transform:uppercase}
.bar b{color:#7AA2E8;font-weight:400}
main{width:100%;max-width:36rem;margin:0 auto;padding:48px 16px 64px}
.eyebrow{margin:0;color:var(--ink-soft);font-size:.75rem;letter-spacing:.18em;text-transform:uppercase}
h1{font:400 clamp(1.75rem,6vw,2.25rem)/1.15 'Audiowide',ui-sans-serif,system-ui,sans-serif;margin:.5rem 0 1rem;overflow-wrap:anywhere}
p{margin:0 0 1rem}
.mono{font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.soft{color:var(--ink-soft)}
fieldset{border:1px solid var(--rule);border-radius:4px;margin:1.5rem 0;padding:.5rem 1rem 1rem}
legend{padding:0 .25rem;font-size:.75rem;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-soft)}
label{display:flex;gap:.75rem;align-items:flex-start;padding:.625rem 0;min-height:44px}
label+label{border-top:1px solid var(--rule)}
input[type=checkbox]{width:1.25rem;height:1.25rem;margin:.2rem 0 0;accent-color:var(--signal);flex:none}
label span b{display:block;font-weight:700}
code{font-size:.9375rem}
.actions{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:1.5rem}
button,.btn{font:inherit;font-weight:700;min-height:44px;padding:.5rem 1.25rem;border-radius:4px;border:1px solid var(--ink);cursor:pointer;text-decoration:none;display:inline-flex;align-items:center}
.primary{background:var(--signal);border-color:var(--signal);color:#fff}
.ghost{background:transparent;color:var(--ink)}
:focus-visible{outline:3px solid var(--signal);outline-offset:2px}
a{color:var(--signal)}
.note{border-top:1px solid var(--rule);margin-top:2rem;padding-top:1rem;font-size:.9375rem;color:var(--ink-soft)}
`;

type PageOpts = { status?: number; eyebrow: string; title: string; body: string; refreshTo?: string };

export function sendPage(res: Response, opts: PageOpts) {
  const nonce = randomBytes(16).toString("base64");
  res.status(opts.status ?? 200);
  res.set({
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Security-Policy":
      `default-src 'none'; style-src 'nonce-${nonce}'; font-src 'self'; img-src 'self'; ` +
      "form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
  });
  const refresh = opts.refreshTo ? `<meta http-equiv="refresh" content="0;url=${escapeHtml(opts.refreshTo)}">` : "";
  res.send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><meta name="referrer" content="no-referrer"><title>${escapeHtml(opts.title)} · Yehuda Briskman</title>${refresh}
<style nonce="${nonce}">${STYLE}</style></head>
<body><div class="bar" aria-hidden="true">Y.B<b>.</b> &nbsp;MCP</div>
<main><p class="eyebrow">${escapeHtml(opts.eyebrow)}</p><h1>${escapeHtml(opts.title)}</h1>${opts.body}</main></body></html>`);
}

export function consentPage(
  res: Response,
  o: { clientName: string; redirectUri: string; login: string; txn: string; csrf: string; writeRequested: boolean },
) {
  const target = new URL(o.redirectUri);
  sendPage(res, {
    eyebrow: "yehudabriskman.com · MCP sign-in",
    title: `Connect ${o.clientName}?`,
    body: `
<p>Signed in with GitHub as <b class="mono">@${escapeHtml(o.login)}</b>.</p>
<p><b>${escapeHtml(o.clientName)}</b> is asking to use this site's MCP server as you. If you allow it, it receives a token at <code class="mono">${escapeHtml(target.origin + target.pathname)}</code>.</p>
<form method="post" action="/mcp/oauth/consent">
<input type="hidden" name="txn" value="${escapeHtml(o.txn)}">
<input type="hidden" name="csrf" value="${escapeHtml(o.csrf)}">
<fieldset><legend>Access</legend>
<label><input type="checkbox" checked disabled><span><b>mcp:read</b>Read every post (drafts included), area and the admin audit log.</span></label>
<label><input type="checkbox" name="write" value="on"${o.writeRequested ? " checked" : ""}><span><b>mcp:write</b>Create and edit posts and areas. Every write is a dry run unless the tool is told otherwise, and a delete needs <code>confirm: true</code>. Each one is in the audit log under this app's name.</span></label>
</fieldset>
<div class="actions"><button class="primary" type="submit" name="decision" value="approve">Allow</button><button class="ghost" type="submit" name="decision" value="deny">Deny</button></div>
</form>
<p class="note">Access tokens last an hour and renew for up to 30 days of use. Revoke this connection at any time under Admin → Connected apps.</p>`,
  });
}

export function notAuthorizedPage(res: Response, login: string, publicUrl: string) {
  sendPage(res, {
    status: 403,
    eyebrow: "yehudabriskman.com · MCP sign-in",
    title: "Not authorized",
    body: `
<p>GitHub says you are <b class="mono">@${escapeHtml(login)}</b>. The admin tools on this server belong to the site's owner, so nothing was granted and no token was issued.</p>
<p>The public tools need no sign-in at all: add <code class="mono">${escapeHtml(publicUrl)}</code> to your MCP client instead.</p>
<p><a href="/developers/mcp">About this MCP server</a></p>`,
  });
}

export function errorPage(res: Response, status: number, title: string, message: string) {
  sendPage(res, {
    status,
    eyebrow: "yehudabriskman.com · MCP sign-in",
    title,
    body: `<p>${escapeHtml(message)}</p><p><a href="/developers/mcp">About this MCP server</a></p>`,
  });
}

/*
 * Back to the client. A page and not a 302: the consent form posts here, and
 * a browser holds a redirect after a form post to the CSP's form-action,
 * which (rightly) names only this origin, not every loopback port a native
 * client might listen on.
 */
export function returnToClientPage(res: Response, clientName: string, target: URL, approved: boolean) {
  sendPage(res, {
    eyebrow: "yehudabriskman.com · MCP sign-in",
    title: approved ? `Returning to ${clientName}` : "Access denied",
    refreshTo: target.href,
    body: `<p>${approved ? "Done. You can close this tab once your client says it is connected." : "Nothing was granted."}</p>
<p><a class="btn ghost" href="${escapeHtml(target.href)}">Continue to ${escapeHtml(clientName)}</a></p>`,
  });
}
