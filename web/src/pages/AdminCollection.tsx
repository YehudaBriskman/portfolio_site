import Select from "@/components/ui/Select";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AdminShell from "@/components/admin/AdminShell";
import { NotFoundState, PageHeader } from "@/components/admin/ui";
import { isNotFound } from "@/services/authError";
import StatusPill, { type SaveState } from "@/components/admin/StatusPill";
import DocPathsEditor from "@/components/admin/DocPathsEditor";
import LinkEditor, { type LinkRow } from "@/components/LinkEditor";
import { admin, slugify, AdminValidationError } from "@/services/admin";
import MediaPicker from "@/components/admin/MediaPicker";
import { Disclosure } from "@/components/ui/Disclosure";
import { useAdminWords } from "@/i18n/admin";
import { useAreaEditorWords } from "@/i18n/areaEditor";
import { useLang } from "@/components/dashboard/i18n";
import { usePhone } from "@/hooks/usePhone";
import { usePostsPhoneWords } from "@/components/admin/posts/words";
import { formatWhen } from "@/lib/safeTime";
import { titleOf } from "@/lib/safeTitle";

type Draft = {
  slug: string;
  title: string;
  tagline: string;
  kind: "site" | "project";
  repoOwner: string;
  repoName: string;
  repoBranch: string;
  docPaths: string[];
  description: string;
  coverImage: string;
  icon: string;
  links: LinkRow[];
  order: string;
  status: "published" | "hidden";
  /* The Hebrew (#248). Empty is untranslated: the site shows the English. */
  heTitle: string;
  heTagline: string;
  heDescription: string;
  _rev?: string;
};

const EMPTY: Draft = {
  slug: "", title: "", tagline: "", kind: "project",
  repoOwner: "", repoName: "", repoBranch: "main", docPaths: [],
  description: "", coverImage: "", icon: "", links: [], order: "50", status: "published",
  heTitle: "", heTagline: "", heDescription: "",
};

export default function AdminCollection() {
  const w = useAdminWords();
  const a = useAreaEditorWords();
  const lang = useLang();
  const { slug } = useParams();
  const isNew = !slug || slug === "new";
  const nav = useNavigate();
  const phone = usePhone();
  const pw = usePostsPhoneWords();
  const [d, setD] = useState<Draft>(EMPTY);
  const [save_, setSave] = useState<SaveState>({ kind: "idle" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  /* A deep link to an area that is gone is not a new area: it says so. */
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (isNew) return;
    admin
      .collections()
      .then((cs) => {
        const c = cs.find((x) => x.slug === slug);
        if (!c) {
          setMissing(true);
          return;
        }
        setStats(c.stats ?? null);
        setD({
          slug: c.slug,
          title: c.title,
          tagline: c.tagline,
          kind: c.kind,
          repoOwner: c.repo?.owner ?? "",
          repoName: c.repo?.name ?? "",
          repoBranch: c.repo?.branch ?? "main",
          docPaths: c.repo?.docPaths ?? [],
          description: c.description,
          coverImage: c.coverImage ?? "",
          icon: c.icon ?? "",
          links: c.links.map((l) =>
            typeof l.label === "string"
              ? { label: l.label, url: l.url, he: "" }
              : { label: l.label.en, url: l.url, he: l.label.he ?? "" },
          ),
          order: String(c.order),
          status: c.status,
          heTitle: c.he?.title ?? "",
          heTagline: c.he?.tagline ?? "",
          heDescription: c.he?.description ?? "",
          _rev: c._rev,
        });
      })
      .catch((e) => (isNotFound(e) ? setMissing(true) : setSave({ kind: "failed", message: e instanceof Error ? e.message : "Failed to load" })));
  }, [slug, isNew]);

  /* Counts edits, so a save can tell whether anything was typed while it was on the wire. */
  const edits = useRef(0);
  const patch = (p: Partial<Draft>) => {
    edits.current += 1;
    setD((prev) => ({ ...prev, ...p }));
    setSave((s) => (s.kind === "saving" ? s : { kind: "dirty" }));
  };

  async function commit() {
    setSave({ kind: "saving" });
    setFieldErrors({});
    const at = edits.current;
    try {
      const saved = await admin.saveCollection(d.slug, {
        title: d.title,
        tagline: d.tagline,
        he:
          d.heTitle.trim() || d.heTagline.trim() || d.heDescription.trim()
            ? {
                title: d.heTitle.trim() || null,
                tagline: d.heTagline.trim() || null,
                description: d.heDescription.trim() || null,
              }
            : null,
        kind: d.kind,
        // Repo config is optional; an area with no repository is perfectly valid.
        // The branch and the allowlist are sent as configured — they used to be
        // hardcoded to "main" and [] here, which silently destroyed both on
        // every save of an area that had them set.
        repo:
          d.repoOwner && d.repoName
            ? {
                owner: d.repoOwner,
                name: d.repoName,
                branch: d.repoBranch.trim() || "main",
                docPaths: d.docPaths,
              }
            : null,
        description: d.description,
        coverImage: d.coverImage.trim() || null,
        icon: d.icon.trim() || null,
        /* Each label as `Text` (#306): the English, and its Hebrew when there is one. */
        links: d.links
          .filter((l) => l.label && l.url)
          .map((l) => ({ label: l.he?.trim() ? { en: l.label, he: l.he.trim() } : { en: l.label }, url: l.url })),
        order: Number(d.order) || 50,
        status: d.status,
        _rev: d._rev,
      });
      setD((p) => ({ ...p, _rev: saved._rev }));
      setSave(edits.current === at ? { kind: "saved", at: new Date() } : { kind: "dirty" });
      if (isNew) nav(`/admin/areas/${saved.slug}`, { replace: true });
    } catch (e) {
      if (e instanceof AdminValidationError) {
        setFieldErrors(e.fieldErrors);
        setSave({ kind: "invalid", message: e.message });
        return;
      }
      const message = e instanceof Error ? e.message : a.saveFailed;
      setSave(/changed elsewhere/i.test(message) ? { kind: "conflict" } : { kind: "failed", message });
    }
  }

  const canSave = save_.kind !== "saving" && Boolean(d.slug) && Boolean(d.title);
  /** The server's complaint about one field, shown under it. */
  const fieldError = (name: string) =>
    fieldErrors[name] ? <span className="a-error">{fieldErrors[name]}</span> : null;
  const heading = isNew ? w.newArea : titleOf(d.title, d.slug);
  const repoLabel = d.repoOwner && d.repoName ? `${d.repoOwner}/${d.repoName}` : "";

  const bottomBar = (
    <div className="flex items-center gap-3 px-4 py-2">
      <StatusPill state={save_} />
      <button type="button" onClick={() => void commit()} disabled={!canSave} className="a-btn a-btn-primary ml-auto">
        {save_.kind === "saving" ? a.saving : a.save}
      </button>
    </div>
  );

  if (missing) {
    return (
      <AdminShell title={w.notFound} section="areas" backTo="/admin/areas">
        <NotFoundState text={w.notFoundArea} to="/admin/areas" back={w.backToAreas} />
      </AdminShell>
    );
  }

  return (
    <AdminShell title={heading} section="areas" backTo="/admin/areas" bottomBar={bottomBar}>
      <form className="max-w-[40rem]" onSubmit={(e) => { e.preventDefault(); if (canSave) void commit(); }}>
        <PageHeader
          title={heading}
          description={a.intro}
        />

        <label className="mt-8 block">
          <span className="a-label">{a.title}</span>
          <input
            value={d.title}
            onChange={(e) => patch({ title: e.target.value, slug: slugTouched ? d.slug : slugify(e.target.value) })}
            className="a-input a-input-title"
            lang="en"
            dir="ltr"
            aria-invalid={fieldErrors.title ? "true" : undefined}
            placeholder="WindoM"
          />
          {fieldError("title")}
        </label>

        <label className="mt-6 block">
          <span className="a-label">{a.tagline}</span>
          <input
            value={d.tagline}
            onChange={(e) => patch({ tagline: e.target.value })}
            className="a-input"
            placeholder="Every new tab becomes a dashboard"
            lang="en"
            dir="ltr"
          />
        </label>

        <label className="mt-6 block">
          <span className="a-label">{a.description}</span>
          <textarea
            value={d.description}
            onChange={(e) => patch({ description: e.target.value })}
            className="a-textarea min-h-[6rem]"
            lang="en"
            dir="ltr"
          />
        </label>

        <Disclosure summary={w.areaHebrew} className="mt-10">
          <p className="a-hint mt-2">
            {a.hebrewHint}
          </p>
          <div className="mt-4 grid grid-cols-1 gap-5" lang="he" dir="rtl">
            <label className="block">
              <span className="a-label" lang="en" dir="ltr">Title</span>
              <input value={d.heTitle} onChange={(e) => patch({ heTitle: e.target.value })} className="a-input" maxLength={120} />
            </label>
            <label className="block">
              <span className="a-label" lang="en" dir="ltr">Tagline</span>
              <input value={d.heTagline} onChange={(e) => patch({ heTagline: e.target.value })} className="a-input" maxLength={160} />
            </label>
            <label className="block">
              <span className="a-label" lang="en" dir="ltr">Description</span>
              <textarea
                value={d.heDescription}
                onChange={(e) => patch({ heDescription: e.target.value })}
                className="a-textarea min-h-[6rem]"
                maxLength={400}
              />
            </label>
          </div>
        </Disclosure>

        <Disclosure open={!phone || isNew ? true : undefined} summary={w.areaDetails} meta={phone && !isNew ? `${pw.kinds[d.kind]} · ${w.status[d.status]}` : undefined} className="mt-10">
          <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="a-label">{a.kind}</span>
              <Select value={d.kind} onChange={(e) => patch({ kind: e.target.value as Draft["kind"] })}>
                <option value="project">{a.kindProject}</option>
                <option value="site">{a.kindSite}</option>
              </Select>
            </label>
            <label className="block">
              <span className="a-label">{a.visibility}</span>
              <Select value={d.status} onChange={(e) => patch({ status: e.target.value as Draft["status"] })}>
                <option value="published">{w.status.published}</option>
                <option value="hidden">{w.status.hidden}</option>
              </Select>
            </label>
            <label className="block">
              <span className="a-label">{a.order}</span>
              <input
                value={d.order}
                onChange={(e) => patch({ order: e.target.value })}
                className="a-input a-input-mono"
                inputMode="numeric"
              />
            </label>
            <label className="block">
              <span className="a-label">{a.slug}</span>
              <input
                value={d.slug}
                onChange={(e) => { setSlugTouched(true); patch({ slug: e.target.value }); }}
                onBlur={(e) => patch({ slug: slugify(e.target.value) })}
                className="a-input a-input-mono"
                autoCapitalize="off"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={fieldErrors.slug ? "true" : undefined}
                placeholder="windom"
              />
              {fieldError("slug")}
              <span className="a-hint">
                {a.slugHintA}<bdi dir="ltr">&ldquo;windom.app&rdquo;</bdi>{a.slugHintB}
              </span>
            </label>
            <label className="block sm:col-span-2">
              <span className="a-label">{a.coverUrl}</span>
              <input
                value={d.coverImage}
                onChange={(e) => patch({ coverImage: e.target.value })}
                className="a-input a-input-mono"
                aria-invalid={fieldErrors.coverImage ? "true" : undefined}
                placeholder="https://…"
              />
              {fieldError("coverImage")}
              <span className="a-hint">
                {a.coverHintA}<bdi className="mono" dir="ltr">/blob/</bdi>{a.coverHintB}<bdi className="mono" dir="ltr">raw.githubusercontent.com</bdi>{a.coverHintC}
              </span>
            </label>
            <div className="sm:col-span-2 -mt-3">
              <MediaPicker value={d.coverImage} onChange={(url) => patch({ coverImage: url })} />
            </div>
            <div className="block sm:col-span-2">
              <span className="a-label" id="area-icon-label">{a.icon}</span>
              <div className="flex flex-wrap items-center gap-3" aria-labelledby="area-icon-label" role="group">
                {d.icon ? (
                  <img src={d.icon} alt="" width={32} height={32} className="rounded-[var(--a-r-ctl)] border border-edge object-contain p-1" />
                ) : (
                  <span className="a-hint m-0">{a.none}</span>
                )}
                <MediaPicker
                  value={d.icon}
                  onChange={(url) => patch({ icon: url })}
                  kinds={["icon"]}
                  label={d.icon ? a.changeIcon : a.chooseIcon}
                />
                {d.icon && (
                  <button type="button" className="a-btn a-btn-ghost mt-2" onClick={() => patch({ icon: "" })}>
                    {a.removeIcon}
                  </button>
                )}
              </div>
              <span className="a-hint">{a.iconHint}</span>
            </div>
          </div>

          {d.coverImage && (
            <img src={d.coverImage} alt="" className="mt-5 max-h-56 w-full rounded-[var(--a-r-box)] border border-edge object-cover" />
          )}

          <div className="mt-6">
            <LinkEditor links={d.links} onChange={(links) => patch({ links })} hebrew />
          </div>
        </Disclosure>

        <Disclosure open={repoLabel ? true : undefined} summary={w.areaRepository} className="mt-6">
          <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-3">
            <label className="block">
              <span className="a-label">{a.owner}</span>
              <input value={d.repoOwner} onChange={(e) => patch({ repoOwner: e.target.value })}
                className="a-input a-input-mono" autoCapitalize="off" spellCheck={false} placeholder="YehudaBriskman" />
            </label>
            <label className="block">
              <span className="a-label">{a.repo}</span>
              <input value={d.repoName} onChange={(e) => patch({ repoName: e.target.value })}
                className="a-input a-input-mono" autoCapitalize="off" spellCheck={false} placeholder="WindoM" />
            </label>
            <label className="block">
              <span className="a-label">{a.branch}</span>
              <input value={d.repoBranch} onChange={(e) => patch({ repoBranch: e.target.value })}
                className="a-input a-input-mono" autoCapitalize="off" spellCheck={false} placeholder="main" />
            </label>
          </div>

          <div className="mt-5">
            <span className="a-label">{a.paths}</span>
            <DocPathsEditor paths={d.docPaths} repoLabel={repoLabel} onChange={(docPaths) => patch({ docPaths })} />
          </div>

          {repoLabel && !isNew && (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="a-btn"
                onClick={async () => {
                  setSyncing(true);
                  try {
                    const r = await admin.syncCollection(d.slug);
                    setStats(r.stats as Record<string, unknown>);
                    setSave({ kind: "saved", at: new Date() });
                  } catch (e) {
                    setSave({ kind: "failed", message: e instanceof Error ? e.message : a.syncFailed });
                  } finally {
                    setSyncing(false);
                  }
                }}
              >
                {syncing ? a.syncing : a.sync}
              </button>
            </div>
          )}

          {stats && (
            <div className="a-card mt-5 p-4">
              <p className="mono text-sm uppercase tracking-[0.22em] text-clay">{a.fromGithub}</p>
              {stats.error ? (
                <p className="a-error">{String(stats.error)}</p>
              ) : (
                <p className="mono mt-2 text-sm text-bone/85">
                  {`${a.stars(String(stats.stars ?? "—"))} · ${stats.language ?? "—"} · ${stats.license ?? "—"} · ${a.fetched(
                    stats.fetchedAt ? formatWhen(String(stats.fetchedAt), lang, { dateStyle: "short", timeStyle: "medium" }) : a.never,
                  )}`}
                </p>
              )}
              <p className="a-hint">{a.refreshHint}</p>
            </div>
          )}
        </Disclosure>

        <div className="mt-10 hidden items-center gap-3 lg:flex">
          <StatusPill state={save_} />
          <button type="button" onClick={() => void commit()} disabled={!canSave} className="a-btn a-btn-primary ml-auto">
            {save_.kind === "saving" ? a.saving : a.saveArea}
          </button>
        </div>
      </form>
    </AdminShell>
  );
}
