import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AdminShell from "@/components/admin/AdminShell";
import { admin, type McpGrant } from "@/services/admin";

/*
 * Connected apps (#263): every MCP client the owner allowed through the
 * remote server's sign-in, and the one action that matters, revoke. A
 * revoked grant stops working on its next request: its access and refresh
 * tokens are refused from then on.
 */

const when = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });
const fmt = (iso: string | null) => (iso ? when.format(new Date(iso)) : "never");

export default function AdminConnections() {
  const [grants, setGrants] = useState<McpGrant[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    admin
      .mcpGrants()
      .then(setGrants)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  async function revoke(g: McpGrant) {
    if (!window.confirm(`Revoke ${g.client}? It stops working on its next request.`)) return;
    setBusy(g.id);
    try {
      const next = await admin.revokeMcpGrant(g.id);
      setGrants((all) => (all ?? []).map((x) => (x.id === next.id ? next : x)));
      setStatus(`${g.client} revoked`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revoke failed");
    } finally {
      setBusy(null);
    }
  }

  const active = (grants ?? []).filter((g) => g.status === "active");
  const past = (grants ?? []).filter((g) => g.status !== "active");

  return (
    <AdminShell title="Connected apps" section="connections" counts={{ connections: grants ? active.length : undefined }}>
      <h1 className="display-tight text-[1.75rem] lg:text-[2.25rem]">Connected apps</h1>
      <p className="a-hint mt-3 max-w-prose">
        MCP clients you signed in to this site&rsquo;s{" "}
        <Link to="/developers/mcp" className="underline hover:text-sodium">
          remote MCP server
        </Link>{" "}
        with GitHub. Access tokens last an hour; a connection renews itself for up to 30 days of use.
      </p>

      <p className="sr-only" role="status">
        {grants === null ? "Loading connected apps" : status || `${active.length} connected`}
      </p>

      {error && <p className="a-card mt-8 p-4 text-sm text-bone/70">{error}</p>}
      {!error && grants === null && <p className="mono mt-8 text-xs text-clay">Loading…</p>}

      {grants !== null && active.length === 0 && (
        <div className="a-card mt-8 p-8 text-center">
          <p className="display-tight text-2xl">Nothing connected</p>
          <p className="a-hint mx-auto mt-3 max-w-sm">
            Run <code className="mono">claude mcp add --transport http yehuda https://yehudabriskman.com/mcp</code>{" "}
            and sign in; the client appears here.
          </p>
        </div>
      )}

      {active.length > 0 && (
        <ul className="mt-6">
          {active.map((g) => (
            <li key={g.id} className="a-row">
              <span className="a-dot a-dot-published" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.9375rem] text-bone">{g.client}</span>
                <span className="mono mt-1 block truncate text-[0.6875rem] tracking-[0.14em] text-clay">
                  {g.scopes.includes("mcp:write") ? "read + write" : "read only"} · connected {fmt(g.createdAt)} · last used{" "}
                  {fmt(g.lastUsedAt)}
                </span>
              </span>
              <button
                type="button"
                className="a-btn a-btn-danger shrink-0"
                disabled={busy === g.id}
                onClick={() => void revoke(g)}
                aria-label={`Revoke ${g.client}`}
              >
                {busy === g.id ? "Revoking…" : "Revoke"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {past.length > 0 && (
        <>
          <h2 className="mono mt-12 text-[0.6875rem] uppercase tracking-[0.18em] text-clay">Ended</h2>
          <ul className="mt-3">
            {past.map((g) => (
              <li key={g.id} className="a-row">
                <span className="a-dot a-dot-archived" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.9375rem] text-bone/70">{g.client}</span>
                  <span className="mono mt-1 block truncate text-[0.6875rem] tracking-[0.14em] text-clay">
                    {g.status === "revoked" ? `revoked ${fmt(g.revokedAt)}${g.revokedReason ? ` · ${g.revokedReason}` : ""}` : `expired ${fmt(g.expiresAt)}`}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </AdminShell>
  );
}
