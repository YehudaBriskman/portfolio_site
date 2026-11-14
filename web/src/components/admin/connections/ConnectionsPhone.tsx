import { useState } from "react";
import { fullDate, relative, useLang } from "@/components/dashboard/i18n";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ICON } from "@/components/ui/icons";
import { RecordRow } from "@/components/ui/RecordRow";
import { StatusGlyph } from "@/components/ui/StatusGlyph";
import { usePhoneAdminWords } from "@/i18n/adminPhone";
import type { McpGrant } from "@/services/admin";
import styles from "@/components/admin/phone/phone.module.css";

/*
 * Connected apps below 600px. A row answers "which app, and is it still
 * allowed?": the client's name, when it was last used (or when it ended) and
 * one glyph only for a grant that is no longer active. Scopes, who signed in
 * and the dates are in the sheet, and so is Revoke, which asks first, naming
 * the app, in the same sheet (a sheet never opens a sheet). A revoked grant
 * stops working on its next request.
 */

const writes = (g: McpGrant) => g.scopes.includes("mcp:write");

export default function ConnectionsPhone({
  grants, onRevoke,
}: {
  grants: McpGrant[];
  /** Revokes on the server and resolves with the grant as it now is; rejects when it fails. */
  onRevoke: (g: McpGrant) => Promise<void>;
}) {
  const p = usePhoneAdminWords().connections;
  const lang = useLang();
  const [now] = useState(() => Date.now());
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [failed, setFailed] = useState("");

  const active = grants.filter((g) => g.status === "active");
  const ended = grants.filter((g) => g.status !== "active");
  const g = grants.find((x) => x.id === openId) ?? null;

  const open = (id: string) => {
    setOpenId(id);
    setConfirm(false);
    setFailed("");
  };
  const close = () => {
    setOpenId(null);
    setConfirm(false);
    setFailed("");
  };

  const fact = (x: McpGrant) => {
    if (x.status === "active") return x.lastUsedAt ? { icon: ICON.when, text: p.lastUsed(relative(x.lastUsedAt, now, lang)) } : { icon: ICON.when, text: p.never };
    const at = x.status === "revoked" ? (x.revokedAt ?? x.expiresAt) : x.expiresAt;
    return { icon: ICON.when, text: relative(at, now, lang) };
  };

  const row = (x: McpGrant) => (
    <RecordRow
      key={x.id}
      as="li"
      icon={ICON.connectedApp}
      title={x.client}
      facts={[fact(x)]}
      status={<StatusGlyph kind={x.status} />}
      openLabel={p.openApp(x.client)}
      onOpen={() => open(x.id)}
    />
  );

  const revoke = async (target: McpGrant) => {
    setBusy(true);
    setFailed("");
    try {
      await onRevoke(target);
      setNotice(p.revoked(target.client));
      setConfirm(false);
    } catch {
      setFailed(p.revokeFailed);
    } finally {
      setBusy(false);
    }
  };

  const fmt = (iso: string) => fullDate(iso, lang);
  const footer =
    g && g.status === "active" ? (
      confirm ? (
        <>
          <button type="button" className="a-btn min-h-[44px]" onClick={() => setConfirm(false)}>{p.keep}</button>
          <button type="button" className="a-btn a-btn-danger min-h-[44px]" disabled={busy} onClick={() => void revoke(g)}>
            {busy ? p.revoking : p.revokeDo(g.client)}
          </button>
        </>
      ) : (
        <button type="button" className="a-btn a-btn-danger min-h-[44px]" onClick={() => setConfirm(true)}>{p.revoke}</button>
      )
    ) : null;

  return (
    <div className={styles.page} data-testid="connections-phone">
      <p className="sr-only" role="status">{notice || p.count(active.length)}</p>
      {active.length > 0 && <ul className={styles.list} aria-label={p.connected}>{active.map(row)}</ul>}
      {ended.length > 0 && (
        <section className={styles.section} aria-labelledby="conn-ended">
          <h2 id="conn-ended" className={styles.heading}>{p.ended}</h2>
          <ul className={styles.list} aria-label={p.ended}>{ended.map(row)}</ul>
        </section>
      )}

      <BottomSheet open={g !== null} onClose={close} title={g ? (confirm ? p.revokeTitle(g.client) : g.client) : ""} footer={footer}>
        {g && confirm && (
          <div className={styles.sheetBody} data-testid="revoke-confirm">
            <p>{p.revokeBody}</p>
            <p role="alert" className={styles.bad}>{failed}</p>
          </div>
        )}
        {g && !confirm && (
          <div className={styles.sheetBody} data-testid="connection-sheet">
            <dl className={styles.facts}>
              <dt>{p.access}</dt>
              <dd>
                <span className={styles.word}>
                  {writes(g) ? <ICON.accessWrite size={16} strokeWidth={1.75} aria-hidden="true" /> : <ICON.accessRead size={16} strokeWidth={1.75} aria-hidden="true" />}
                  {writes(g) ? p.accessWrite : p.accessRead}
                </span>
              </dd>
              <dt>{p.scopes}</dt>
              <dd className={styles.ltr}>{g.scopes.map((s) => <code key={s} className="block">{s}</code>)}</dd>
              <dt>{p.signedIn}</dt>
              <dd dir="ltr" className={styles.ltr}>{g.login}</dd>
              <dt>{p.connectedOn}</dt>
              <dd className={styles.num}>{fmt(g.createdAt)}</dd>
              <dt>{p.lastUsedLabel}</dt>
              <dd className={styles.num}>{g.lastUsedAt ? fmt(g.lastUsedAt) : p.never}</dd>
              {g.status === "active" && (
                <>
                  <dt>{p.expires}</dt>
                  <dd className={styles.num}>{fmt(g.expiresAt)}</dd>
                </>
              )}
              {g.status !== "active" && (
                <>
                  <dt>{p.endedOn}</dt>
                  <dd className={styles.num}>{fmt(g.status === "revoked" ? (g.revokedAt ?? g.expiresAt) : g.expiresAt)}</dd>
                </>
              )}
              {g.revokedReason && (
                <>
                  <dt>{p.reason}</dt>
                  <dd dir="auto">{g.revokedReason}</dd>
                </>
              )}
              <dt>{p.status}</dt>
              <dd><StatusGlyph kind={g.status} withWord showDefault size={16} /></dd>
            </dl>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
