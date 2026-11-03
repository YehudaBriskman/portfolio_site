import { useEffect, useState } from "react";
import PageShell from "@/components/PageShell";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { OWNER_READ, OWNER_WRITE, PUBLIC, type Tool } from "@/lib/mcpTools";

/*
 * The remote MCP server's page (#263): the "known place". What the server
 * is, what its tools do, and the one line that connects a client.
 *
 * The tool lists (lib/mcpTools.ts) mirror mcp/src/tools.ts (PUBLIC_TOOLS, ADMIN_READ_TOOLS,
 * ADMIN_TOOLS); src/pages/__tests__/DevelopersMcp.test.tsx fails if a tool is
 * added there and not here. The server's address is this origin's, so the
 * page is right on preprod and in development as well as in production.
 *
 * Whether the server is switched on (MCP_REMOTE) is asked of the server
 * itself, through its public metadata: a 404 means not yet, and the page
 * says so instead of handing out a command that would fail.
 */

type Availability = "checking" | "on" | "off";

function useAvailability(): Availability {
  const [state, setState] = useState<Availability>("checking");
  useEffect(() => {
    const ctl = new AbortController();
    fetch("/.well-known/oauth-protected-resource/mcp", { signal: ctl.signal, headers: { Accept: "application/json" } })
      .then(async (r) => {
        const body: unknown = r.ok ? await r.json().catch(() => null) : null;
        setState(body && typeof body === "object" && "resource" in body ? "on" : "off");
      })
      .catch(() => {
        if (!ctl.signal.aborted) setState("off");
      });
    return () => ctl.abort();
  }, []);
  return state;
}

function CopyLine({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);
  return (
    <div className="mt-3">
      <p className="mono text-xs uppercase tracking-[0.16em] text-clay">{label}</p>
      <div className="mt-2 flex min-w-0 items-stretch border border-rule-firm bg-paper">
        <code className="mono min-w-0 flex-1 overflow-x-auto whitespace-nowrap px-4 py-3 text-sm text-ink" translate="no">
          {text}
        </code>
        <button
          type="button"
          className="mono min-h-11 shrink-0 border-l border-rule-firm px-4 text-xs uppercase tracking-[0.16em] text-ink transition-colors hover:bg-ink hover:text-paper focus-visible:bg-ink focus-visible:text-paper"
          onClick={() => {
            void navigator.clipboard?.writeText(text).then(() => setCopied(true));
          }}
          aria-label={`Copy: ${label}`}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <span className="sr-only" role="status">
        {copied ? "Copied to the clipboard" : ""}
      </span>
    </div>
  );
}

function ToolTable({ caption, tools }: { caption: string; tools: Tool[] }) {
  return (
    <table className="mt-4 w-full border-collapse text-left text-[0.9375rem]">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-rule-firm">
          <th scope="col" className="mono w-[42%] py-2 pe-4 text-xs sm:w-56 font-normal uppercase tracking-[0.16em] text-clay">
            Tool
          </th>
          <th scope="col" className="mono py-2 text-xs font-normal uppercase tracking-[0.16em] text-clay">
            What it does
          </th>
        </tr>
      </thead>
      <tbody>
        {tools.map((t) => (
          <tr key={t.name} className="border-b border-rule align-top">
            <th scope="row" className="mono py-2.5 pe-4 text-sm font-normal text-ink" translate="no">
              {t.name}
            </th>
            <td className="py-2.5 text-ink">{t.does}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function DevelopersMcp() {
  useDocumentTitle("MCP server");
  const availability = useAvailability();
  const origin = typeof window === "undefined" ? "https://yehudabriskman.com" : window.location.origin;
  const url = `${origin}/mcp`;

  return (
    <PageShell>
      <section className="wrap section-y">
        <p className="eyebrow">Developers</p>
        <h1 className="display mt-3 text-section">MCP server</h1>

        <div className="mt-8 max-w-[68ch] space-y-5 text-[1.0625rem] leading-relaxed text-ink">
          <p>
            This site speaks the Model Context Protocol. Point Claude, or any MCP client, at it and
            it can read the posts, the project areas and the channel log. There is nothing to
            download and no key to copy: the client signs in through the browser.
          </p>

          <p className="mono text-sm" role="status">
            {availability === "checking" && "Checking the server…"}
            {availability === "on" && <>Status: <span className="text-signal">live</span></>}
            {availability === "off" && "Status: not switched on yet. The commands below will work once it is."}
          </p>

          <h2 className="display display-md pt-6 text-object">Connect</h2>
          <CopyLine label="Claude Code" text={`claude mcp add --transport http yehuda ${url}`} />
          <CopyLine label="claude.ai and Claude Desktop: Settings → Connectors → Add custom connector" text={url} />
          <p>
            The first call opens a browser window. Anyone can connect: the public tools answer
            without an account. Signing in with GitHub unlocks the owner&rsquo;s tools, and only
            for the site&rsquo;s owner; any other account is told so and given nothing.
          </p>
          <p>
            To skip sign-in entirely, use the public endpoint, which carries only the public tools:
          </p>
          <CopyLine label="Public tools only" text={`claude mcp add --transport http yehuda-public ${url}/public`} />

          <h2 className="display display-md pt-6 text-object">Tools</h2>
          <h3 className="mono pt-2 text-xs uppercase tracking-[0.16em] text-clay">Public, no sign-in</h3>
          <ToolTable caption="Public tools" tools={PUBLIC} />
          <h3 className="mono pt-6 text-xs uppercase tracking-[0.16em] text-clay">Owner, read access (mcp:read)</h3>
          <ToolTable caption="Owner read tools" tools={OWNER_READ} />
          <h3 className="mono pt-6 text-xs uppercase tracking-[0.16em] text-clay">Owner, write access (mcp:write)</h3>
          <ToolTable caption="Owner write tools" tools={OWNER_WRITE} />

          <h2 className="display display-md pt-6 text-object">How sign-in works</h2>
          <ul className="list-disc space-y-2 ps-6">
            <li>
              Standard OAuth 2.1 with PKCE. The client discovers everything from{" "}
              <code className="mono text-sm">/.well-known/oauth-protected-resource</code> and registers itself.
            </li>
            <li>
              Identity comes from GitHub. The site never sees a password and keeps no GitHub token.
            </li>
            <li>
              The owner chooses the access on a consent screen: read, or read and write. Writes are
              dry runs unless the tool is told otherwise, deletes need explicit confirmation, and
              every change is in the audit log under the client&rsquo;s name.
            </li>
            <li>
              Access tokens last an hour and renew for up to 30 days of use. Any connection can be
              revoked from the site&rsquo;s admin at once.
            </li>
          </ul>
        </div>
      </section>
    </PageShell>
  );
}
