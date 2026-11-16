import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AdminShell from "@/components/admin/AdminShell";
import ConnectionsPhone from "@/components/admin/connections/ConnectionsPhone";
import { Empty, EmptyState, ErrorState, LoadingRows, PageHeader, RelTime, StatePill, UnreadableNote } from "@/components/admin/ui";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { RowActions } from "@/components/ui/RowActions";
import { ICON } from "@/components/ui/icons";
import { usePhoneAdminWords } from "@/i18n/adminPhone";
import { useAdminWords } from "@/i18n/admin";
import { usePhone } from "@/hooks/usePhone";
import { admin, type McpGrant } from "@/services/admin";
import { isNotAuthorised, NOT_AUTHORISED, signInHref } from "@/services/authError";
import { formatWhen } from "@/lib/safeTime";
import { unreadableCount } from "@/services/tolerant";

/*
 * Connected apps (#263): every MCP client the owner allowed through the
 * remote server's sign-in, and the one action that matters, revoke. A
 * revoked grant stops working on its next request: its access and refresh
 * tokens are refused from then on.
 */

type ConnectionWords = ReturnType<typeof usePhoneAdminWords>["connections"];

const fmt = (iso: string | null) => (iso ? formatWhen(iso, "en", { dateStyle: "medium", timeStyle: "short" }) : "never");

export default function AdminConnections() {
  const [grants, setGrants] = useState<McpGrant[] | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [error, setError] = useState<string | null>(null);
  /* A failed revoke is that row's problem: the list and the other grants stay. */
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const phone = usePhone();
  const pw = usePhoneAdminWords().connections;
  const aw = useAdminWords();
  /* The app waiting for the owner's answer; nothing is revoked until the dialog's confirm. */
  const [asking, setAsking] = useState<McpGrant | null>(null);

  useEffect(() => {
    admin
      .mcpGrants()
      .then((g) => (setGrants(g), setSkipped(unreadableCount(g))))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  async function revoke(g: McpGrant) {
    setBusy(g.id);
    setRowError(null);
    try {
      const next = await admin.revokeMcpGrant(g.id);
      setGrants((all) => (all ?? []).map((x) => (x.id === next.id ? next : x)));
      setStatus(pw.revoked(g.client));
    } catch (e) {
      setRowError({ id: g.id, message: isNotAuthorised(e) ? NOT_AUTHORISED : e instanceof Error ? e.message : "Revoke failed" });
    } finally {
      setBusy(null);
      setAsking(null);
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
        <caption className="sr-only">{ended ? pw.ended : pw.connected}</caption>
        <thead>
          <tr>
            <th scope="col">{pw.app}</th>
            <th scope="col" className="hidden md:table-cell">
              {pw.access}
            </th>
            <th scope="col" className="hidden sm:table-cell">
              {ended ? pw.endedOn : pw.lastUsedLabel}
            </th>
            <th scope="col" className="hidden lg:table-cell">
              {pw.connectedOn}
            </th>
            <th scope="col">
              <span className="sr-only">{ended ? pw.status : aw.colActions}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => (
            <tr key={g.id}>
              <td>
                <span className="a-row-title">{g.client}</span>
                <span className="a-row-meta md:hidden">
                  <span>{access(g, pw)}</span>
                  <span className="sm:hidden">
                    {ended ? endedAt(g, pw) : <>{pw.lastUsedLabel} {g.lastUsedAt ? <RelTime iso={g.lastUsedAt} /> : pw.never}</>}
                  </span>
                </span>
              </td>
              <td className="hidden md:table-cell">{access(g, pw)}</td>
              <td className="a-when hidden sm:table-cell">
                {ended ? endedAt(g, pw) : g.lastUsedAt ? <RelTime iso={g.lastUsedAt} /> : <Empty label={pw.never} />}
              </td>
              <td className="a-when hidden lg:table-cell">
                <span title={fmt(g.createdAt)}>
                  <RelTime iso={g.createdAt} />
                </span>
              </td>
              <td className="a-fit text-end">
                {ended ? (
                  <StatePill state={g.status} />
                ) : (
                  <RowActions
                    label={g.client}
                    moreLabel={aw.moreActions}
                    actions={[{ id: "revoke", icon: ICON.revoked, label: busy === g.id ? pw.revoking : pw.revoke, tone: "danger", disabled: busy === g.id, onSelect: () => setAsking(g) }]}
                  />
                )}
                {!ended && rowError?.id === g.id && (
                  <p role="alert" className="a-error mt-1">
                    {rowError.message === NOT_AUTHORISED ? (
                      <>
                        {pw.sessionEnded}{" "}
                        <a className="a-link" href={signInHref(window.location.pathname + window.location.search)}>
                          {pw.signInAgain}
                        </a>
                      </>
                    ) : (
                      `${pw.revokeFailed} (${g.client})`
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
    <AdminShell title={pw.title} section="connections" counts={{ connections: grants ? active.length : undefined }}>
      <div className="a-wrap">
        <PageHeader
          title={pw.title}
          description={phone ? undefined : (
            <>
              {pw.description}{" "}
              <Link to="/developers/mcp" className="a-link">
                {pw.remoteServer}
              </Link>
            </>
          )}
        />

        <p className="sr-only" role="status">
          {phone ? "" : grants === null ? pw.loading : status || pw.statusLine(active.length)}
        </p>

        <UnreadableNote count={skipped} />

        {error ? (
          <ErrorState message={error} />
        ) : grants === null ? (
          <LoadingRows rows={2} label={phone ? pw.loading : undefined} />
        ) : phone && grants.length > 0 ? (
          <ConnectionsPhone grants={grants} onRevoke={revokeQuiet} />
        ) : active.length === 0 ? (
          <EmptyState title={pw.emptyTitle}>
            <code className="font-mono text-sm" dir="ltr">claude mcp add --transport http yehuda https://yehudabriskman.com/mcp</code>{" "}
            {pw.emptyRun}
          </EmptyState>
        ) : (
          table(active, false)
        )}

        {!phone && past.length > 0 && (
          <section aria-labelledby="ended-apps" className="mt-8">
            <h2 id="ended-apps" className="a-h2 mb-3">
              {pw.ended}
            </h2>
            {table(past, true)}
          </section>
        )}
      </div>
      <ConfirmDialog
        open={asking !== null}
        title={asking ? pw.revokeTitle(asking.client) : ""}
        confirm={asking ? pw.revokeDo(asking.client) : ""}
        cancel={pw.keep}
        busy={busy !== null}
        onConfirm={() => asking && void revoke(asking)}
        onCancel={() => setAsking(null)}
      >
        {pw.revokeBody}
      </ConfirmDialog>
    </AdminShell>
  );
}

function access(g: McpGrant, pw: ConnectionWords): string {
  return g.scopes.includes("mcp:write") ? pw.accessWrite : pw.accessRead;
}

function endedAt(g: McpGrant, pw: ConnectionWords) {
  return g.status === "revoked" ? (
    <>
      {pw.revokedAt} <RelTime iso={g.revokedAt} />
      {g.revokedReason ? ` · ${g.revokedReason}` : ""}
    </>
  ) : (
    <>
      {pw.expiredAt} <RelTime iso={g.expiresAt} />
    </>
  );
}
