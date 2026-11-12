import { useId, useState } from "react";
import { adminAudience, type Group } from "@/services/adminAudience";
import { useAudienceWords } from "./words";

/* Rare: rename, create and remove groups. Lives in a collapsed section. System groups are locked. */
export default function GroupsPanel({ groups, onChange }: { groups: Group[]; onChange: () => void }) {
  const w = useAudienceWords();
  const uid = useId();
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<{ slug: string; name: string } | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const run = async (op: () => Promise<unknown>, done?: () => void) => {
    setError(false);
    try {
      await op();
      done?.();
      onChange();
    } catch {
      setError(true);
    }
  };

  return (
    <div className="space-y-3">
      <p className="a-hint !mt-0">{w.groupsHint}</p>
      <ul className="space-y-2" aria-label={w.groupsHeading}>
        {groups.map((g) => {
          const locked = g.kind === "system";
          const edit = renaming?.slug === g.slug;
          return (
            <li key={g.slug} className="a-box flex flex-wrap items-center gap-2 p-2 ps-4">
              <div className="min-w-0 flex-1 basis-40">
                {edit ? (
                  <form
                    className="flex flex-wrap gap-2"
                    onSubmit={(e) => (e.preventDefault(), renaming.name.trim() && void run(() => adminAudience.renameGroup(g.slug, renaming.name.trim()), () => setRenaming(null)))}
                  >
                    <label className="sr-only" htmlFor={`${uid}-${g.slug}`}>{w.groupName}</label>
                    <input id={`${uid}-${g.slug}`} className="a-input min-h-[44px] min-w-0 flex-1" value={renaming.name} maxLength={60} autoFocus onChange={(e) => setRenaming({ slug: g.slug, name: e.target.value })} />
                    <button type="submit" className="a-btn a-btn-primary min-h-[44px]">{w.save}</button>
                    <button type="button" className="a-btn a-btn-ghost min-h-[44px]" onClick={() => setRenaming(null)}>{w.cancel}</button>
                  </form>
                ) : (
                  <>
                    <p className="truncate text-sm font-bold" dir="auto">{g.name}</p>
                    {locked && <p className="text-xs text-clay">{w.locked}</p>}
                  </>
                )}
              </div>
              <span className="text-sm tabular-nums text-clay" aria-label={w.members(g.count)}>{new Intl.NumberFormat("en-GB").format(g.count)}</span>
              {!locked && !edit && (
                <>
                  <button type="button" className="a-btn min-h-[44px]" aria-label={w.renameGroup(g.name)} onClick={() => setRenaming({ slug: g.slug, name: g.name })}>{w.renameShort}</button>
                  {confirm === g.slug ? (
                    <>
                      <button type="button" className="a-btn min-h-[44px] !border-[rgb(var(--destructive-ink))] text-[rgb(var(--destructive-ink))]" onClick={() => void run(() => adminAudience.deleteGroup(g.slug), () => setConfirm(null))}>{w.deleteGroupConfirm(g.name)}</button>
                      <button type="button" className="a-btn a-btn-ghost min-h-[44px]" onClick={() => setConfirm(null)}>{w.cancel}</button>
                    </>
                  ) : (
                    <button type="button" className="a-btn a-btn-ghost min-h-[44px]" aria-label={w.deleteGroup(g.name)} onClick={() => setConfirm(g.slug)}>{w.deleteShort}</button>
                  )}
                </>
              )}
              {confirm === g.slug && <p className="a-hint !mt-0 basis-full">{w.deleteGroupHint}</p>}
            </li>
          );
        })}
      </ul>
      <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => (e.preventDefault(), name.trim() && void run(() => adminAudience.createGroup(name.trim()), () => setName("")))}>
        <div className="min-w-0 flex-1 basis-48">
          <label className="a-label" htmlFor={`${uid}-new`}>{w.newGroup}</label>
          <input id={`${uid}-new`} className="a-input min-h-[44px]" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </div>
        <button type="submit" className="a-btn min-h-[44px]" disabled={!name.trim()}>{w.createGroup}</button>
      </form>
      {error && <p className="a-error" role="alert">{w.saveFailed}</p>}
    </div>
  );
}
