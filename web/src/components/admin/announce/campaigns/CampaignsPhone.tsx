import { useMemo, useState } from "react";
import { FilterChips, FiltersRestoredNote } from "@/components/ui/FilterChips";
import { FilterSheet } from "@/components/ui/FilterSheet";
import { ICON } from "@/components/ui/icons";
import { MiniBar } from "@/components/ui/MiniBar";
import { ListPresence } from "@/components/ui/ListPresence";
import { RecordRow, type Fact } from "@/components/ui/RecordRow";
import { SelectionBar, SelectionHeader, type SelectionAction } from "@/components/ui/SelectionBar";
import { StatusGlyph } from "@/components/ui/StatusGlyph";
import { useSavedFilters } from "@/components/ui/useSavedFilters";
import { useSelection } from "@/components/ui/useSelection";
import { tidy, type FilterDef } from "@/components/ui/filters";
import { INTL, useLang } from "@/components/dashboard/i18n";
import { numberIn } from "@/i18n/words";
import type { SenderSettings } from "@/services/adminAnnounce";
import type { Group } from "@/services/adminAudience";
import { adminCampaigns, CAMPAIGN_STATUSES, type Campaign, type CampaignStatus } from "@/services/adminCampaigns";
import { createPayload } from "./helpers";
import CampaignSheet from "./CampaignSheet";
import { usePhoneCampaignWords } from "./phoneWords";
import { useCampaignWords } from "./words";
import styles from "./CampaignsPhone.module.css";
import { formatWhen, parseWhen } from "@/lib/safeTime";

/*
 * Campaigns below 600px. A row answers "is anything sending, did it go out,
 * did it go wrong?": the name, when, one more fact, ONE status glyph and,
 * while mail is going out, a bar. Everything else is one tap away in the
 * sheet. Bulk select is for drafts only: a campaign that has started is never
 * copied or deleted in bulk.
 */

const STAGES: Record<string, CampaignStatus[]> = {
  draft: ["draft"],
  live: ["scheduled", "sending", "paused"],
  done: ["sent", "failed", "canceled"],
};

const isDraft = (c: Campaign) => c.status === "draft";
const handled = (c: Campaign) => c.counters.sent + c.counters.failed + c.counters.suppressed + (c.counters.capped ?? 0);

export default function CampaignsPhone({
  items, sender, groups, onOpen, onChanged,
}: {
  items: Campaign[];
  sender: SenderSettings | null;
  groups: Group[];
  onOpen: (id: string) => void;
  onChanged: () => void;
}) {
  const w = useCampaignWords();
  const p = usePhoneCampaignWords();
  const lang = useLang();
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const defs = useMemo<FilterDef[]>(
    () => [
      {
        id: "stage", kind: "segmented", label: p.stage,
        options: (["draft", "live", "done"] as const).map((v) => ({ value: v, label: p.stages[v] })),
      },
      {
        id: "status", kind: "multi", label: p.statusFilter,
        options: CAMPAIGN_STATUSES.map((s) => ({ value: s, label: w.statuses[s] })),
      },
    ],
    [p, w],
  );
  const [filters, setFilters, saved] = useSavedFilters("campaigns", defs);

  const matches = (c: Campaign, f: typeof filters) => {
    const stage = typeof f.stage === "string" ? STAGES[f.stage] : null;
    const status = Array.isArray(f.status) ? f.status : null;
    return (!stage || stage.includes(c.status)) && (!status || status.includes(c.status));
  };
  const visible = items.filter((c) => matches(c, filters));

  const drafts = visible.filter(isDraft);
  const selection = useSelection(drafts.map((c) => c.id));
  const rows = selection.on ? drafts : visible;

  /* A row says "11 Nov"; the year only when it is not this one. The full date and time are in the sheet. */
  const when = (iso: string, time: boolean) => {
    const d = parseWhen(iso);
    const year = d && d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" as const } : {};
    return formatWhen(iso, lang, { day: "numeric", month: "short", ...year, ...(time ? { hour: "2-digit", minute: "2-digit" } : {}) });
  };
  const num = (n: number) => numberIn(lang, n);

  const factsOf = (c: Campaign): [Fact?, Fact?] => {
    const first: Fact =
      c.status === "scheduled" && c.sendAt
        ? { icon: ICON.when, text: when(c.sendAt, true), label: w.statuses.scheduled }
        : c.finishedAt
          ? { icon: ICON.when, text: when(c.finishedAt, false), label: w.finished }
          : { icon: ICON.when, text: when(c.updatedAt, false) };
    const q = c.counters.queued;
    let second: Fact | undefined;
    if (c.status === "sending" || c.status === "paused") second = { text: `${num(handled(c))}/${num(q)}`, label: p.progressLabel, dir: "ltr" };
    else if (c.counters.failed > 0 && c.status !== "draft") second = { icon: ICON.failedCount, text: num(c.counters.failed), label: p.failedLabel, dir: "ltr" };
    else if (q > 0 && c.status !== "draft" && c.status !== "scheduled") second = { icon: ICON.to, text: num(q), label: p.toLabel, dir: "ltr" };
    return [first, second];
  };

  const statusOf = (c: Campaign) => (
    <span className={styles.status}>
      {(c.status === "sending" || c.status === "paused") && c.counters.queued > 0 && (
        <MiniBar
          className={styles.bar}
          total={c.counters.queued}
          label={w.of(handled(c), c.counters.queued)}
          parts={[
            { value: c.counters.sent, tone: "ok" },
            { value: c.counters.failed, tone: "danger" },
            { value: c.counters.suppressed + (c.counters.capped ?? 0), tone: "muted" },
          ]}
        />
      )}
      <StatusGlyph kind={c.status} />
    </span>
  );

  const bulk = async (ids: string[], op: (c: Campaign) => Promise<unknown>, ok: (n: number) => string, fail: string) => {
    const chosen = items.filter((c) => ids.includes(c.id) && isDraft(c));
    const results = await Promise.allSettled(chosen.map(op));
    const done = results.filter((r) => r.status === "fulfilled").length;
    setNotice(done === chosen.length ? ok(done) : `${done > 0 ? `${ok(done)} ` : ""}${fail}`);
    onChanged();
  };

  const actions: SelectionAction<string>[] = [
    {
      id: "duplicate", icon: ICON.copy, label: p.duplicate,
      run: (ids) =>
        bulk(
          ids,
          (c) => adminCampaigns.create(createPayload({ name: p.copyOf(c.name), subject: c.subject, preheader: c.preheader, bodyText: c.bodyText, blocks: c.blocks, groups: c.groups, lang: c.lang, topic: c.topic })),
          p.copiedMany,
          p.copyFailed,
        ),
    },
    {
      id: "delete", icon: ICON.delete, label: p.bulkDelete, destructive: true, confirm: p.bulkDeleteConfirm,
      run: (ids) => bulk(ids, (c) => adminCampaigns.remove(c.id), p.deletedMany, p.deleteFailed),
    },
  ];

  const sheetCampaign = items.find((c) => c.id === sheetId) ?? null;
  const filtered = visible.length !== items.length;

  return (
    <div className={styles.wrap} data-testid="campaigns-phone">
      <div className={styles.toolbar}>
        <div className={styles.chips}>
          <FilterChips defs={defs} value={filters} onChange={setFilters} common={["stage"]} onOpenSheet={() => setFiltersOpen(true)} resultCount={visible.length} />
        </div>
        <SelectionHeader selection={selection} total={drafts.length} />
      </div>
      <FiltersRestoredNote restored={saved.restored} onUndo={saved.undoRestore} onDismiss={saved.dismissRestored} />
      {selection.on && <p className="a-hint !mt-0">{p.selectNote}</p>}
      <p role="status" className={styles.notice}>{notice}</p>

      {rows.length === 0 ? (
        <p className="a-hint" data-testid="no-match">{filtered || selection.on ? p.noMatch : w.empty}</p>
      ) : (
        <ListPresence as="ul" items={rows} itemKey={(c) => c.id} className={`${styles.list} a-settle`} aria-label={w.tableLabel}>
          {(c) => (
            <RecordRow
              as="div"
              icon={ICON.announcement}
              title={c.name}
              facts={factsOf(c)}
              status={statusOf(c)}
              selectable={selection.on}
              selected={selection.has(c.id)}
              openLabel={w.open(c.name)}
              onOpen={() => (selection.on ? selection.toggle(c.id) : setSheetId(c.id))}
              onLongPress={isDraft(c) ? () => selection.enter(c.id) : undefined}
            />
          )}
        </ListPresence>
      )}

      <SelectionBar selection={selection} actions={actions} />

      <FilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        defs={defs}
        value={filters}
        onApply={setFilters}
        resultCount={(draft) => items.filter((c) => matches(c, tidy(defs, draft))).length}
      />

      <CampaignSheet
        campaign={sheetCampaign}
        sender={sender}
        groups={groups}
        onClose={() => setSheetId(null)}
        onChanged={onChanged}
        onOpen={onOpen}
        onNotice={setNotice}
      />
    </div>
  );
}
