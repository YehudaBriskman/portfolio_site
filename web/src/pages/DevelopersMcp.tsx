import { useEffect, useState } from "react";
import PageShell from "@/components/PageShell";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { OWNER_READ, OWNER_WRITE, PUBLIC, type Tool } from "@/lib/mcpTools";
import { useMcpWords } from "@/i18n/statement";
import { useLang } from "@/components/dashboard/i18n";

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
  const w = useMcpWords();
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);
  return (
    <div className="mt-3">
      <p className="mono text-xs uppercase tracking-[0.16em] text-clay">{label}</p>
      <div className="mt-2 flex min-w-0 items-stretch border border-rule-firm bg-paper">
        <code className="mono min-w-0 flex-1 overflow-x-auto whitespace-nowrap px-4 py-3 text-sm text-ink" translate="no" dir="ltr">
          {text}
        </code>
        <button
          type="button"
          className="mono min-h-11 shrink-0 border-s border-rule-firm px-4 text-xs uppercase tracking-[0.16em] text-ink transition-colors hover:bg-ink hover:text-paper focus-visible:bg-ink focus-visible:text-paper"
          onClick={() => {
            void navigator.clipboard?.writeText(text).then(() => setCopied(true));
          }}
          aria-label={w.copyLabel(label)}
        >
          {copied ? w.copied : w.copy}
        </button>
      </div>
      <span className="sr-only" role="status">
        {copied ? w.copiedSay : ""}
      </span>
    </div>
  );
}

function ToolTable({ caption, tools }: { caption: string; tools: Tool[] }) {
  const w = useMcpWords();
  return (
    <table className="mt-4 w-full border-collapse text-start text-[0.9375rem]">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-rule-firm">
          <th scope="col" className="mono w-[42%] py-2 pe-4 text-xs sm:w-56 font-normal uppercase tracking-[0.16em] text-clay">
            {w.tool}
          </th>
          <th scope="col" className="mono py-2 text-xs font-normal uppercase tracking-[0.16em] text-clay">
            {w.does}
          </th>
        </tr>
      </thead>
      <tbody>
        {tools.map((t) => (
          <tr key={t.name} className="border-b border-rule align-top">
            <th scope="row" className="mono py-2.5 pe-4 text-sm font-normal text-ink" translate="no">
              {t.name}
            </th>
            <td className="py-2.5 text-ink">{w.toolsDo[t.name] ?? t.does}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function DevelopersMcp() {
  const w = useMcpWords();
  useDocumentTitle(w.title);
  const lang = useLang();
  const availability = useAvailability();
  const origin = typeof window === "undefined" ? "https://yehudabriskman.com" : window.location.origin;
  const url = `${origin}/mcp`;

  return (
    <PageShell>
      <section className="wrap section-y">
        <p className="eyebrow">{w.eyebrow}</p>
        <h1 className="display mt-3 text-section">{w.title}</h1>

        <div className="mt-8 max-w-[36em] space-y-5 text-[1.0625rem] leading-relaxed text-ink">
          <p>
            {w.intro}
          </p>

          <p className="mono text-sm" role="status">
            {availability === "checking" && w.checking}
            {availability === "on" && (
              <>
                {w.status} <span className="text-signal">{w.live}</span>
              </>
            )}
            {availability === "off" && w.off}
          </p>

          <h2 className="display display-md pt-6 text-object">{w.connect}</h2>
          <p>{w.connectIntro}</p>
          <CopyLine label="Claude Code" text={`claude mcp add --transport http yehuda-public ${url}/public`} />
          <CopyLine label={w.desktop} text={`${url}/public`} />

          <h2 className="display display-md pt-6 text-object">{w.ownerHead}</h2>
          <p>{w.ownerIntro}</p>
          <CopyLine label="Claude Code" text={`claude mcp add --transport http yehuda ${url}`} />
          <CopyLine label={w.desktop} text={url} />

          <h2 className="display display-md pt-6 text-object">{w.tools}</h2>
          <h3 className="mono pt-2 text-xs uppercase tracking-[0.16em] text-clay">{w.publicHead}</h3>
          <ToolTable caption={w.publicCaption} tools={PUBLIC} />
          <h3 className="mono pt-6 text-xs uppercase tracking-[0.16em] text-clay">{w.readHead}</h3>
          <ToolTable caption={w.readCaption} tools={OWNER_READ} />
          <h3 className="mono pt-6 text-xs uppercase tracking-[0.16em] text-clay">{w.writeHead}</h3>
          <ToolTable caption={w.writeCaption} tools={OWNER_WRITE} />

          <h2 className="display display-md pt-6 text-object">{w.how}</h2>
          <ul className="list-disc space-y-2 ps-6">
            <li>
              {w.howBefore}
              {lang === "en" && " "}
              <code className="mono text-sm" dir="ltr">/.well-known/oauth-protected-resource</code> {w.howAfter}
            </li>
            {w.howItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>
    </PageShell>
  );
}
