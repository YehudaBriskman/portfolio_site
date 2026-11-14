import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AdminShell from "@/components/admin/AdminShell";
import ConnectionsPhone from "@/components/admin/connections/ConnectionsPhone";
import { Empty, EmptyState, ErrorState, LoadingRows, PageHeader, RelTime, StatePill } from "@/components/admin/ui";
import { usePhoneAdminWords } from "@/i18n/adminPhone";
import { usePhone } from "@/hooks/usePhone";
import { admin, type McpGrant } from "@/services/admin";
import { isNotAuthorised, NOT_AUTHORISED, signInHref } from "@/services/authError";

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
  /* A failed revoke is that row's problem: the list and the other grants stay. */
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const phone = usePhone();
  const pw = usePhoneAdminWords().connections;

  useEffect(() => {
    admin
      .mcpGrants()
      .then(setGrants)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  async function revoke(g: McpGrant) {
    if (!window.confirm(`Revoke ${g.client}? It stops working on its next request.`)) return;
    setBusy(g.id);
    setRowError(null);
    try {
      const next = await admin.revokeMcpGrant(g.id);
      setGrants((all) => (all ?? []).map((x) => (x.id === next.id ? next : x)));
      setStatus(`${g.client} revoked`);
    } catch (e) {
      setRowError({ id: g.id, message: isNotAuthorised(e) ? NOT_AUTHORISED : e instanceof Error ? e.message : "Revoke failed" });
    } finally {
      setBusy(null);
    }
  }

  /* The phone's sheet asks first and shows a failure in itself, so it takes the bare call. */
  async function revokeQuiet(g: McpGrant) {
    const next = await admin.revokeMcpGrant(g.id);
    setGrants((all) => (all ?? []).map((x) => (x.id === next.id ? next : x)));
  }

  const active = (grants ?? []).filter((g) => g.status === "active");
  const past = (grants ?? []).filter((g) => g.status !== "active");

  const table = (rows: McpGrant[], ended: boolean) => (
    <div className="a-box overflow-x-auto">
      <table className="a-table">
        <caption className="sr-only">{ended ? "Ended" : "Connected"}</caption>
        <thead>
          <tr>
            <th scope="col">App</th>
            <th scope="col" className="hidden md:table-cell">
              Access
            </th>
            <th scope="col" className="hidden sm:table-cell">
              {ended ? "Ended" : "Last used"}
            </th>
            <th scope="col" className="hidden lg:table-cell">
              Connected
            </th>
            <th scope="col">
              <span className="sr-only">{ended ? "Status" : "Actions"}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => (
            <tr key={g.id}>
              <td>
                <span className="a-row-title">{g.client}</span>
                <span className="a-row-meta md:hidden">
                  <span>{access(g)}</span>
                  <span className="sm:hidden">
                    {ended ? endedAt(g) : <>last used {g.lastUsedAt ? <RelTime iso={g.lastUsedAt} /> : "never"}</>}
                  </span>
                </span>
              </td>
              <td className="hidden md:table-cell">{access(g)}</td>
              <td className="a-when hidden sm:table-cell">
                {ended ? endedAt(g) : g.lastUsedAt ? <RelTime iso={g.lastUsedAt} /> : <Empty label="Never used" />}
              </td>
              <td className="a-when hidden lg:table-cell">
                <span title={fmt(g.createdAt)}>
                  <RelTime iso={g.createdAt} />
                </span>
              </td>
              <td className="a-fit text-right">
                {ended ? (
                  <StatePill state={g.status} />
                ) : (
                  <button
                    type="button"
                    className="a-btn a-btn-danger"
                    disabled={busy === g.id}
                    onClick={() => void revoke(g)}
                    aria-label={`Revoke ${g.client}`}
                  >
                    {busy === g.id ? "Revoking…" : "Revoke"}
                  </button>
                )}
                {!ended && rowError?.id === g.id && (
                  <p role="alert" className="a-error mt-1">
                    {rowError.message === NOT_AUTHORISED ? (
                      <>
                        Your session has ended.{" "}
                        <a className="a-link" href={signInHref(window.location.pathname + window.location.search)}>
                          Sign in again
                        </a>
                      </>
                    ) : (
                      `Couldn't revoke ${g.client}: ${rowError.message}`
                    )}
                  </p>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <AdminShell title={phone ? pw.title : "Connected apps"} section="connections" counts={{ connections: grants ? active.length : undefined }}>
      <div className="a-wrap">
        <PageHeader
          title={phone ? pw.title : "Connected apps"}
          description={phone ? undefined : (
            <>
              MCP clients you signed in to this site&rsquo;s{" "}
              <Link to="/developers/mcp" className="a-link">
                remote MCP server
              </Link>{" "}
              with GitHub. Access tokens last an hour; a connection renews itself for up to 30 days of use.
            </>
          )}
        />

        <p className="sr-only" role="status">
          {phone ? "" : grants === null ? "Loading connected apps" : status || `${active.length} connected`}
        </p>

        {error ? (
          <ErrorState message={error} />
        ) : grants === null ? (
          <LoadingRows rows={2} label={phone ? pw.loading : undefined} />
        ) : phone && grants.length > 0 ? (
          <ConnectionsPhone grants={grants} onRevoke={revokeQuiet} />
        ) : active.length === 0 ? (
          <EmptyState title="Nothing connected">
            Run <code className="font-mono text-sm">claude mcp add --transport http yehuda https://yehudabriskman.com/mcp</code>{" "}
            and sign in; the client appears here.
          </EmptyState>
        ) : (
          table(active, false)
        )}

        {!phone && past.length > 0 && (
          <section aria-labelledby="ended-apps" className="mt-8">
            <h2 id="ended-apps" className="a-h2 mb-3">
              Ended
            </h2>
            {table(past, true)}
          </section>
        )}
      </div>
    </AdminShell>
  );
}

function access(g: McpGrant): string {
  return g.scopes.includes("mcp:write") ? "Read and write" : "Read only";
}

function endedAt(g: McpGrant) {
  return g.status === "revoked" ? (
    <>
      Revoked <RelTime iso={g.revokedAt} />
      {g.revokedReason ? ` · ${g.revokedReason}` : ""}
    </>
  ) : (
    <>
      Expired <RelTime iso={g.expiresAt} />
    </>
  );
}
