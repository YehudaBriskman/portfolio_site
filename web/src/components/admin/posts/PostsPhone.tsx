import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AdminShell from "@/components/admin/AdminShell";
import { contentOf } from "@/components/admin/noteEditor/content";
import { EmptyState, ErrorState, LoadingRows, UnreadableNote } from "@/components/admin/ui";
import { FilterChips, FiltersRestoredNote } from "@/components/ui/FilterChips";
import { FilterSheet } from "@/components/ui/FilterSheet";
import type { FilterDef } from "@/components/ui/filters";
import { ICON } from "@/components/ui/icons";
import { RecordRow, type Fact } from "@/components/ui/RecordRow";
import { SelectionBar, SelectionHeader, type SelectionAction } from "@/components/ui/SelectionBar";
import { StatusGlyph, type StatusKind } from "@/components/ui/StatusGlyph";
import { toast } from "@/lib/toast";
import { useToastWords } from "@/i18n/toast";
import { useUndoable } from "@/lib/toast/useUndoable";
import { useSavedFilters } from "@/components/ui/useSavedFilters";
import { useSelection } from "@/components/ui/useSelection";
import { relative, useLang } from "@/components/dashboard/i18n";
import { useAdminWords } from "@/i18n/admin";
import { admin, type AdminCollection, type AdminPost } from "@/services/admin";
import { useTranslationStatus } from "@/services/translations";
import { usePostsPhoneWords } from "./words";
import { unreadableCount } from "@/services/tolerant";
import { titleOf } from "@/lib/safeTitle";

type Pending = "draft" | "archived";

/*
 * Posts below 600px. The job: find the note to finish or fix. A row is the title, how long ago it changed and
 * ONE glyph only when something needs the owner: a draft, unpublished changes, an archived note, or a published
 * note whose Hebrew is missing or old. The area, tags and reading time are in the editor and the Filters sheet,
 * not on the row. A row opens the editor, as the desktop link does; long-press and the Select button choose rows.
 *
 * Bulk: "Move to drafts" and "Archive" (the server's soft delete; there is no hard delete here). Both wait out an
 * Undo window before they are asked of the server, and Archive asks first. There is no bulk Publish on purpose:
 * a publish is decided looking at its review, one note at a time.
 */
export default function PostsPhone() {
  const w = useAdminWords();
  const p = usePostsPhoneWords();
  const lang = useLang();
  const nav = useNavigate();
  const heStatus = useTranslationStatus();
  const [posts, setPosts] = useState<AdminPost[] | null>(null);
  const [cols, setCols] = useState<AdminCollection[] | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sheet, setSheet] = useState(false);
  const [pending, setPending] = useState<Readonly<Record<string, Pending>>>({});
  const [now] = useState(() => Date.now());
  const undoable = useUndoable();

  const load = useCallback(() => {
    Promise.all([admin.list(), admin.collections()])
      .then(([list, areas]) => {
        setPosts(list);
        setCols(areas);
        setSkipped(unreadableCount(list) + unreadableCount(areas));
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(load, [load]);

  const statusOf = useCallback((post: AdminPost) => pending[post.slug] ?? post.status, [pending]);

  const defs = useMemo<FilterDef[]>(
    () => [
      {
        id: "status",
        kind: "segmented",
        label: p.filterStatus,
        options: (["published", "draft", "archived"] as const).map((s) => ({ value: s, label: w.status[s], count: (posts ?? []).filter((x) => statusOf(x) === s).length })),
      },
      {
        id: "he",
        kind: "segmented",
        label: p.filterHebrew,
        options: [
          { value: "missing", label: p.heMissing },
          { value: "stale", label: p.heStale },
        ],
      },
      {
        id: "area",
        kind: "segmented",
        label: p.filterArea,
        options: (cols ?? []).map((c) => ({ value: c.slug, label: c.title, count: (posts ?? []).filter((x) => x.collection === c.slug).length })),
      },
    ],
    [p, w, cols, posts, statusOf],
  );
  const [filters, setFilters, saved] = useSavedFilters("posts", defs);
  const str = (id: string) => (typeof filters[id] === "string" && filters[id] !== "all" ? (filters[id] as string) : "");
  const status = str("status");
  const area = str("area");
  const he = str("he");

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (posts ?? [])
      .filter((x) => !area || x.collection === area)
      .filter((x) => !status || statusOf(x) === status)
      .filter((x) => !he || heStatus("post", x.slug) === he)
      .filter((x) => !term || [x.title, x.slug, x.excerpt, ...x.tags].some((f) => f.toLowerCase().includes(term)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [posts, q, area, status, he, statusOf, heStatus]);
  const selection = useSelection(useMemo(() => visible.map((x) => x.slug), [visible]));

  /* ---------------------------------------------------------------- bulk */
  const chosen = (slugs: string[]) => (posts ?? []).filter((x) => slugs.includes(x.slug));
  const run = async (list: AdminPost[], job: (post: AdminPost) => Promise<unknown>): Promise<void> => {
    const results = await Promise.allSettled(list.map(job));
    const left = list.filter((_, i) => results[i].status === "rejected");
    if (left.length) toast.error(p.failedSome(left.length), { action: { label: useToastWords.of(document.documentElement.lang === "he" ? "he" : "en").retry, onClick: () => void run(left, job).then(load) } });
  };
  const defer = (slugs: string[], to: Pending, message: string, job: (post: AdminPost) => Promise<unknown>) => {
    const list = chosen(slugs).filter((x) => statusOf(x) !== to && !(to === "draft" && statusOf(x) !== "published"));
    if (list.length === 0) return;
    const ids = list.map((x) => x.slug);
    setPending((cur) => ({ ...cur, ...Object.fromEntries(ids.map((id) => [id, to])) }));
    const drop = () => setPending((cur) => Object.fromEntries(Object.entries(cur).filter(([id]) => !ids.includes(id))));
    undoable.schedule({
      message,
      onUndo: drop,
      commit: async () => {
        await run(list, job);
        drop();
        load();
      },
    });
  };

  const actions: SelectionAction<string>[] = [
    {
      id: "drafts",
      icon: ICON.draft,
      label: p.draftsAct,
      run: (ids) => defer(ids, "draft", p.movingToDrafts(chosen(ids).filter((x) => statusOf(x) === "published").length), (x) => admin.save(x.slug, { ...contentOf(x, false), status: "draft", _rev: x._rev })),
    },
    {
      id: "archive",
      icon: ICON.archived,
      label: p.archiveAct,
      destructive: true,
      confirm: p.archiveConfirm,
      run: (ids) => defer(ids, "archived", p.archiving(chosen(ids).filter((x) => statusOf(x) !== "archived").length), (x) => admin.archive(x.slug)),
    },
  ];

  const rowFor = (x: AdminPost) => {
    const state = statusOf(x);
    const hebrew = state === "published" ? heStatus("post", x.slug) : null;
    const glyph: StatusKind | null =
      state === "archived" ? "archived" : state === "draft" ? "draft" : x.draft ? "changes" : hebrew === "missing" || hebrew === "stale" ? hebrew : null;
    const facts: [Fact?] = [{ icon: ICON.when, text: relative(x.updatedAt, now, lang), label: p.updated }];
    const title = titleOf(x.title, x.slug);
    return (
      <RecordRow
        key={x.slug}
        as="li"
        icon={ICON.note}
        title={title}
        facts={facts}
        status={glyph ? <StatusGlyph kind={glyph} /> : undefined}
        selectable={selection.on}
        selected={selection.has(x.slug)}
        openLabel={selection.on ? title : p.openPost(title, facts[0]?.text)}
        onOpen={() => (selection.on ? selection.toggle(x.slug) : nav(`/admin/posts/${x.slug}`))}
        onLongPress={() => selection.enter(x.slug)}
      />
    );
  };

  const filtered = Boolean(status || area || he || q.trim());

  return (
    <AdminShell title={w.nav.posts} section="posts" counts={{ posts: posts?.length, areas: cols?.length }}>
      <div className="a-wrap min-w-0 space-y-2" data-testid="posts-phone">
        <h1 className="sr-only">{w.nav.posts}</h1>

        {selection.on ? (
          <SelectionHeader selection={selection} total={visible.length} />
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <input type="search" className="a-input min-h-[44px] min-w-0 flex-[1_1_7rem] !ps-3 text-base" dir="auto" aria-label={p.searchPosts} placeholder={p.searchPostsHint} value={q} onChange={(e) => setQ(e.target.value)} />
            {visible.length > 0 && <SelectionHeader selection={selection} total={visible.length} />}
            <Link to="/admin/posts/new" className="a-btn a-btn-primary inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center" aria-label={p.newPost} title={p.newPost}>
              <ICON.add size={20} strokeWidth={2} aria-hidden="true" focusable="false" />
            </Link>
          </div>
        )}

        <FilterChips defs={defs} value={filters} onChange={setFilters} common={["status", "he"]} onOpenSheet={() => setSheet(true)} resultCount={visible.length} />
        <FiltersRestoredNote restored={saved.restored} onUndo={saved.undoRestore} onDismiss={saved.dismissRestored} />

        <p className="sr-only" role="status">{posts ? p.count(visible.length) : ""}</p>

        <UnreadableNote count={skipped} />

        {error ? (
          <ErrorState message={error} onRetry={() => (setError(null), load())} />
        ) : posts === null ? (
          <LoadingRows label={w.loading} />
        ) : posts.length === 0 ? (
          <EmptyState title={w.nothingWritten} action={<Link to="/admin/posts/new" className="a-btn a-btn-primary">{w.writeFirst}</Link>} />
        ) : visible.length === 0 ? (
          <EmptyState title={w.noMatch} action={filtered ? <button type="button" className="a-btn min-h-[44px]" onClick={() => (setQ(""), saved.clear())}>{w.clearFilters}</button> : undefined} />
        ) : (
          <ul aria-label={w.nav.posts} className="a-box m-0 list-none overflow-hidden p-0">
            {visible.map(rowFor)}
          </ul>
        )}

        <SelectionBar selection={selection} actions={actions} />
      </div>

      <FilterSheet open={sheet} onClose={() => setSheet(false)} defs={defs} value={filters} onApply={(next) => (setFilters(next), setSheet(false))} />
    </AdminShell>
  );
}
