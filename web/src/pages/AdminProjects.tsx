import { useId, useState } from "react";
import { useSearchParams } from "react-router-dom";
import HeGlyph from "@/components/admin/posts/HeGlyph";
import { DataTable, type Column, type DataTableWords } from "@/components/ui/DataTable";
import { EditableCell } from "@/components/ui/EditableCell";
import { EmptyState } from "@/components/ui/EmptyState";
import { RowActions } from "@/components/ui/RowActions";
import { SidePanel } from "@/components/ui/SidePanel";
import { useAdminWords } from "@/i18n/admin";
import { toast } from "@/lib/toast";
import { useToastWords } from "@/i18n/toast";
import { useProjectsWords } from "@/components/admin/content/projectsWords";
import { useTranslationStatus, type TranslationStatus } from "@/services/translations";
import { usePhone } from "@/hooks/usePhone";
import { RecordRow } from "@/components/ui/RecordRow";
import { StatusGlyph } from "@/components/ui/StatusGlyph";
import { ICON } from "@/components/ui/icons";
import { Icon, type IconProps } from "@/components/ui/Icon";
import { DisclosureButton } from "@/components/ui/Disclosure";
import { LangSwitch } from "@/components/admin/content/editLang";
import { ReorderRows, ReorderToggle } from "@/components/admin/content/Reorder";
import { useContentWords } from "@/components/admin/content/words";
import { useFormText } from "@/components/admin/content/formWords";
import { ARROWS } from "@/i18n/words";
import { useLang } from "@/components/dashboard/i18n";
import styles from "@/components/admin/content/EditorPhone.module.css";
import EditorFrame from "@/components/admin/content/EditorFrame";
import MediaPicker from "@/components/admin/MediaPicker";
import { useContentEditor } from "@/components/admin/content/editor";
import {
  ListField,
  NarrowContext,
  NumberField,
  PlainField,
  SelectField,
  Section,
  TextField,
} from "@/components/admin/content/Fields";
import { FIELD_KINDS, ProjectsContentSchema, type Project, type ProjectsContent, type Text } from "@/content/schema";

/*
 * /admin/projects (#163): every project the site shows, in the shape
 * `content/schema.ts` gives it. The list on the left is the order the work
 * page uses; the form edits the one picked.
 */

const blank = (order: number): Project => ({
  slug: "new-project",
  title: "New project",
  fact: { en: "" },
  fields: [{ kind: "state", value: "In progress" }],
  description: { en: "" },
  tech: [],
  image: null,
  tint: [64, 64, 64],
  link: null,
  linkLabel: null,
  links: [],
  github: null,
  year: String(new Date().getFullYear()),
  status: { en: "" },
  state: "In progress",
  highlights: [],
  problem: null,
  role: null,
  outcome: null,
  decisions: [],
  order,
  storyLine: { en: "" },
});

const orNull = (s: string) => (s.trim() === "" ? null : s);
const req = (t: Text | null): Text => t ?? { en: "" };

export default function AdminProjects() {
  const editor = useContentEditor<ProjectsContent>("projects", ProjectsContentSchema);
  /* Undefined until the owner picks one: then `?project=windom` (a Translations row, #302) decides.
     On a desktop null is a closed panel; a phone always has one project in its form. */
  const [picked, setPicked] = useState<number | null | undefined>(undefined);
  const heStatus = useTranslationStatus();
  const [query] = useSearchParams();
  const wanted = query.get("project");
  const phone = usePhone();
  const w = useContentWords();
  const tr = useFormText();
  const lang = useLang();
  const pw = useProjectsWords();
  const tt = useToastWords();
  const [reordering, setReordering] = useState(false);

  return (
    <EditorFrame
      title="Projects"
      section="projects"
      intro="The projects on the home page, the work page and each project page. English is required; Hebrew is optional and falls back to English. Images are paths or https URLs."
      preview="/projects?preview=1"
      editor={editor}
      focus={(v, field, q) => {
        const i = v.items.findIndex((p) => p.slug === q.get("project"));
        return i < 0 ? field : `items.${i}.${field}`;
      }}
    >
      {(content) => {
        const items = content.items;
        const fromQuery = wanted ? items.findIndex((x) => x.slug === wanted) : -1;
        const last = items.length - 1;
        const at = phone
          ? Math.min(picked ?? Math.max(fromQuery, 0), last)
          : Math.min(picked === undefined ? fromQuery : (picked ?? -1), last);
        const p = items[at];
        const base = `items.${at}`;
        const set = (change: (draft: Project) => void) => editor.edit((d) => change(d.items[at]));
        /* The order field follows the list, so moving a row is the whole act. */
        const reorder = (next: Project[]) =>
          editor.edit((d) => {
            d.items = next.map((item, i) => ({ ...item, order: i }));
          });
        const changeList = (next: Project[]) => {
          reorder(next);
          if (next.length > items.length) setPicked(next.length - 1);
          else if (next.length < items.length && !phone) setPicked(null);
        };

        /* The fields, made once. The desktop lays them out as four sections; a
           phone as four groups (Basics, Links, Media, Details), so a field is
           drawn in exactly one place either way and writes the same payload. */
        const f = p && {
          title: <PlainField id="project-title" path={`${base}.title`} label="Title" value={p.title} onChange={(v) => set((d) => void (d.title = v))} />,
          slug: <PlainField id="project-slug" path={`${base}.slug`} label="Slug" mono dir="ltr" hint="The address: /projects/<slug>" value={p.slug} onChange={(v) => set((d) => void (d.slug = v))} />,
          year: <PlainField id="project-year" path={`${base}.year`} label="Year" mono dir="ltr" value={p.year} onChange={(v) => set((d) => void (d.year = v))} />,
          state: <PlainField id="project-state" path={`${base}.state`} label="State" hint={pw.stateHint} value={p.state} onChange={(v) => set((d) => void (d.state = v))} />,
          fact: <TextField id="project-fact" path={`${base}.fact`} label="One-line fact" value={p.fact} onChange={(t) => set((d) => void (d.fact = req(t)))} />,
          description: <TextField id="project-description" path={`${base}.description`} label="Description" multiline value={p.description} onChange={(t) => set((d) => void (d.description = req(t)))} />,
          status: <TextField id="project-status" path={`${base}.status`} label="Status line" value={p.status} onChange={(t) => set((d) => void (d.status = req(t)))} />,
          storyLine: <TextField id="project-story-line" path={`${base}.storyLine`} label="Line on the story page" hint="The sentence /story tells about this project." value={p.storyLine} onChange={(t) => set((d) => void (d.storyLine = req(t)))} />,
          cardFields: (
            <ListField
              id="project-fields"
              path={`${base}.fields`}
              legend="Label fields (one to three)"
              items={p.fields}
              name={(x) => `${x.kind}: ${x.value}`}
              make={() => ({ kind: "tech" as const, value: "" })}
              max={3}
              addLabel="Add a field"
              onChange={(next) => set((d) => void (d.fields = next))}
            >
              {(x, i) => (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
                  <SelectField<(typeof FIELD_KINDS)[number]> id={`project-fields-${i}-kind`} path={`${base}.fields.${i}.kind`} label="Kind" value={x.kind} options={FIELD_KINDS} onChange={(v) => set((d) => void (d.fields[i].kind = v))} />
                  <PlainField id={`project-fields-${i}-value`} path={`${base}.fields.${i}.value`} label="Value" value={x.value} onChange={(v) => set((d) => void (d.fields[i].value = v))} />
                </div>
              )}
            </ListField>
          ),
          tech: (
            <PlainField
              id="project-tech"
              path={`${base}.tech`}
              label="Tech"
              hint="Comma-separated, in the order shown."
              value={p.tech.join(", ")}
              onChange={(v) => set((d) => void (d.tech = v.split(",").map((x) => x.trim()).filter(Boolean)))}
            />
          ),
          image: (
            <div className="min-w-0">
              <PlainField id="project-image" path={`${base}.image`} label="Image" mono dir="ltr" hint="A picture from the library, /projects/… or https://…; empty for none." value={p.image ?? ""} onChange={(v) => set((d) => void (d.image = orNull(v)))} />
              {/* The media library (#253): fills the field with the picture's stable URL. */}
              <MediaPicker value={p.image ?? ""} onChange={(url) => set((d) => void (d.image = url))} />
            </div>
          ),
          tint: (
            <fieldset>
              <legend className="a-label">{pw.tint}</legend>
              <div className="grid grid-cols-3 gap-3">
                {([pw.red, pw.green, pw.blue] as const).map((c, i) => (
                  <NumberField key={i} id={`project-tint-${i}`} path={`${base}.tint.${i}`} label={c} value={p.tint[i] as number} onChange={(n) => set((d) => void (d.tint[i] = n))} />
                ))}
              </div>
            </fieldset>
          ),
          link: <PlainField id="project-link" path={`${base}.link`} label="Main link" type="url" mono dir="ltr" value={p.link ?? ""} onChange={(v) => set((d) => void (d.link = orNull(v)))} />,
          linkLabel: <PlainField id="project-link-label" path={`${base}.linkLabel`} label="Main link label" value={p.linkLabel ?? ""} onChange={(v) => set((d) => void (d.linkLabel = orNull(v)))} />,
          github: <PlainField id="project-github" path={`${base}.github`} label="Repository" type="url" mono dir="ltr" value={p.github ?? ""} onChange={(v) => set((d) => void (d.github = orNull(v)))} />,
          links: (
            <ListField
              id="project-links"
              path={`${base}.links`}
              legend="More links"
              items={p.links}
              name={(l) => l.label.en || "New link"}
              make={() => ({ label: { en: "" }, url: "" })}
              max={8}
              addLabel="Add a link"
              onChange={(next) => set((d) => void (d.links = next))}
            >
              {(l, i) => (
                <>
                  <TextField id={`project-links-${i}-label`} path={`${base}.links.${i}.label`} label="Label" value={l.label} onChange={(t) => set((d) => void (d.links[i].label = t ?? { en: "" }))} />
                  <PlainField id={`project-links-${i}-url`} path={`${base}.links.${i}.url`} label="URL" type="url" mono dir="ltr" value={l.url} onChange={(v) => set((d) => void (d.links[i].url = v))} />
                </>
              )}
            </ListField>
          ),
          highlights: (
            <ListField
              id="project-highlights"
              path={`${base}.highlights`}
              legend="Highlights"
              items={p.highlights}
              name={(h) => h.en.slice(0, 40) || "New highlight"}
              make={() => ({ en: "" })}
              max={8}
              addLabel="Add a highlight"
              onChange={(next) => set((d) => void (d.highlights = next))}
            >
              {(h, i) => (
                <TextField id={`project-highlights-${i}`} path={`${base}.highlights.${i}`} label={`Highlight ${i + 1}`} value={h} onChange={(t) => set((d) => void (d.highlights[i] = req(t)))} />
              )}
            </ListField>
          ),
          problem: <TextField id="project-problem" path={`${base}.problem`} label="The problem" multiline nullable value={p.problem} onChange={(t) => set((d) => void (d.problem = t))} />,
          role: <TextField id="project-role" path={`${base}.role`} label="My role" multiline nullable value={p.role} onChange={(t) => set((d) => void (d.role = t))} />,
          outcome: <TextField id="project-outcome" path={`${base}.outcome`} label="The outcome" multiline nullable value={p.outcome} onChange={(t) => set((d) => void (d.outcome = t))} />,
          decisions: (
            <ListField
              id="project-decisions"
              path={`${base}.decisions`}
              legend="Decisions"
              items={p.decisions}
              name={(dc) => dc.title.en.slice(0, 40) || "New decision"}
              make={() => ({ title: { en: "" }, body: { en: "" } })}
              max={8}
              addLabel="Add a decision"
              onChange={(next) => set((d) => void (d.decisions = next))}
            >
              {(dc, i) => (
                <>
                  <TextField id={`project-decisions-${i}-title`} path={`${base}.decisions.${i}.title`} label="Title" value={dc.title} onChange={(t) => set((d) => void (d.decisions[i].title = req(t)))} />
                  <TextField id={`project-decisions-${i}-body`} path={`${base}.decisions.${i}.body`} label="Body" multiline value={dc.body} onChange={(t) => set((d) => void (d.decisions[i].body = req(t)))} />
                </>
              )}
            </ListField>
          ),
          preview: (
            <p className="a-hint">
              <a className="inline-flex min-h-11 items-center underline" href={`/projects/${p.slug}?preview=1`} target="_blank" rel="noreferrer">
                {tr("Preview this project")} {ARROWS[lang].out}
              </a>
            </p>
          ),
        };

        if (phone) {
          return (
            <div className="mt-4 min-w-0">
              <ProjectListPhone
                items={items}
                at={at}
                reordering={reordering}
                onReordering={setReordering}
                onPick={(i) => {
                  setPicked(i);
                  document.getElementById("project-editing")?.scrollIntoView?.({ block: "start" });
                }}
                onChange={changeList}
                heStatus={(item) => heStatus("project", item.slug)}
                addLabel={tr("Add a project")}
                canAdd={items.length < 60}
                make={() => blank(items.length)}
              />
              {p && f && (
                <div className="min-w-0">
                  <h2 id="project-editing" className="sr-only" tabIndex={-1}>
                    {w.reorder.editing}: <bdi>{p.title || tr("Untitled")}</bdi>
                  </h2>
                  <LangSwitch />
                  <Section title={w.group.basics} defaultOpen>
                    <div className="grid grid-cols-1 gap-4">
                      {f.title}
                      {f.slug}
                      {f.year}
                      {f.state}
                    </div>
                    {f.fact}
                  </Section>
                  <Section title={w.group.links}>
                    {f.link}
                    {f.linkLabel}
                    {f.github}
                    {f.links}
                  </Section>
                  <Section title={w.group.media}>
                    {f.image}
                    {f.tint}
                  </Section>
                  <Section title={w.group.details}>
                    {f.description}
                    {f.status}
                    {f.storyLine}
                    {f.cardFields}
                    {f.tech}
                    {f.highlights}
                    {f.problem}
                    {f.role}
                    {f.outcome}
                    {f.decisions}
                    {f.preview}
                  </Section>
                </div>
              )}
            </div>
          );
        }

        /* Found in the latest draft by what the row is, so an Undo that outlives a render still finds it. */
        const move = (row: Project, to: number) => {
          const from = items.indexOf(row);
          if (from === at) setPicked(to);
          editor.edit((d) => {
            const i = d.items.findIndex((x) => x.slug === row.slug && x.title === row.title);
            if (i < 0) return;
            const [moved] = d.items.splice(i, 1);
            d.items.splice(to, 0, moved);
            d.items.forEach((x, j) => void (x.order = j));
          });
        };
        return (
          <div className="mt-6 min-w-0">
            <ProjectsTable
              items={items}
              heStatus={(item) => heStatus("project", item.slug)}
              onOpen={setPicked}
              onMove={move}
              onRemove={(i) => {
                const gone = items[i];
                const before = items;
                changeList(items.filter((_, j) => j !== i));
                toast.info(pw.removed(gone.title), { action: { label: tt.undo, onClick: () => reorder([...before]) } });
              }}
              onAdd={() => changeList([...items, blank(items.length)])}
              canAdd={items.length < 60}
            />
            <SidePanel open={Boolean(p && f)} onOpenChange={(o) => !o && setPicked(null)} title={p ? p.title || tr("Untitled") : ""}>
              {p && f && (
                <NarrowContext.Provider value>
                  <div className="min-w-0">
                    <Section title={w.group.basics} defaultOpen>
                      <div className="grid grid-cols-2 gap-4">
                        {f.title}
                        {f.year}
                      </div>
                      {f.slug}
                      {f.state}
                      {f.fact}
                    </Section>
                    <Section title={w.group.links}>
                      {f.link}
                      {f.linkLabel}
                      {f.github}
                      {f.links}
                    </Section>
                    <Section title={w.group.media}>
                      {f.image}
                      {f.tint}
                    </Section>
                    <Section title={w.group.details}>
                      {f.description}
                      {f.status}
                      {f.storyLine}
                      {f.cardFields}
                      {f.tech}
                      {f.highlights}
                      {f.problem}
                      {f.role}
                      {f.outcome}
                      {f.decisions}
                      {f.preview}
                    </Section>
                  </div>
                </NarrowContext.Provider>
              )}
            </SidePanel>
          </div>
        );
      }}
    </EditorFrame>
  );
}

type PhoneListProps = {
  items: readonly Project[];
  at: number;
  reordering: boolean;
  onReordering: (on: boolean) => void;
  onPick: (i: number) => void;
  onChange: (next: Project[]) => void;
  heStatus: (item: Project) => TranslationStatus | null | undefined;
  addLabel: string;
  canAdd: boolean;
  make: () => Project;
};

/**
 * The project list on a phone: one compact row per project (its title, the
 * year, one glyph when the Hebrew needs work), tapped to edit it. Reordering
 * and removing sit behind one Reorder button, so no row carries buttons.
 */
function ProjectListPhone({ items, at, reordering, onReordering, onPick, onChange, heStatus, addLabel, canAdd, make }: PhoneListProps) {
  const w = useContentWords();
  const Lead = ICON.project;
  const id = useId();
  const [all, setAll] = useState(at >= PEEK);
  /* Four rows and the rest one tap away: the first screen has to show the
     list and the first group of the form, not the list alone. The project
     being edited is always among the rows shown. */
  const shown = all ? items.length : Math.min(items.length, PEEK);
  return (
    <section aria-labelledby="projects-list-title">
      <div className={styles.listHead}>
        <h2 id="projects-list-title" className={styles.listTitle}>
          {w.reorder.list}
        </h2>
        <span className="flex items-center gap-2">
          {canAdd && !reordering && (
            <button type="button" className={`a-btn a-btn-ghost ${styles.iconBtn}`} aria-label={addLabel} onClick={() => {
                setAll(true);
                onChange([...items, make()]);
              }}>
              <Icon icon={ICON.add} aria-hidden="true" />
            </button>
          )}
          {items.length > 1 && <ReorderToggle on={reordering} onToggle={() => onReordering(!reordering)} />}
        </span>
      </div>
      {reordering ? (
        <ReorderRows items={items} name={(item) => item.title} onChange={onChange} />
      ) : (
        <>
          <ul id={id} className={styles.list}>
            {items.slice(0, shown).map((item, i) => {
              const he = heStatus(item);
              const current = i === at;
              return (
                <RecordRow
                  key={i}
                  as="li"
                  icon={Lead}
                  title={item.title}
                  facts={[{ text: item.year, dir: "ltr" }]}
                  status={he ? <StatusGlyph kind={he} /> : undefined}
                  className={current ? styles.current : undefined}
                  trailing={current ? <Icon icon={ICON.draft} size={16} aria-hidden="true" /> : "chevron"}
                  openLabel={w.reorder.edit(item.title)}
                  onOpen={() => onPick(i)}
                />
              );
            })}
          </ul>
          {items.length > PEEK && (
            <div className="mt-2">
              <DisclosureButton expanded={all} controls={id} onToggle={() => setAll(!all)}>
                {all ? w.reorder.showFewer : w.reorder.showAll(items.length)}
              </DisclosureButton>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** Rows of the list shown before "Show all". */
const PEEK = 4;

type TableProps = {
  items: readonly Project[];
  heStatus: (item: Project) => TranslationStatus | null | undefined;
  onOpen: (i: number) => void;
  onMove: (row: Project, to: number) => void;
  onRemove: (i: number) => void;
  onAdd: () => void;
  canAdd: boolean;
};

/**
 * The projects as a table in the order the site shows them: the row is the order, a row's actions are
 * Edit (the side panel), Move up, Move down and, behind More, Remove. A project's own title and address
 * are the one identifier; its Hebrew is one glyph, said by the glyph alone.
 */
function ProjectsTable({ items, heStatus, onOpen, onMove, onRemove, onAdd, canAdd }: TableProps) {
  const pw = useProjectsWords();
  const w = useAdminWords();
  const at = (row: Project) => items.indexOf(row);
  const words: DataTableWords = {
    selectAll: pw.colProject,
    selectRow: (label) => label,
    actions: w.colActions,
    loading: w.loading,
    bulkLabel: w.colActions,
    count: (n) => String(n),
    cancel: pw.colProject,
    more: w.moreActions,
  };
  const columns: Column<Project>[] = [
    {
      id: "order",
      header: pw.colOrder,
      align: "num",
      width: "6rem",
      /* Typing a position moves the row there; Undo on the toast moves it back. */
      cell: (r) => (
        <EditableCell
          kind="number"
          align="num"
          label={pw.colOrder}
          min={1}
          max={items.length}
          value={at(r) + 1}
          savedText={pw.moved}
          onSave={(n) => onMove(r, Math.min(items.length, Math.max(1, Number(n))) - 1)}
        />
      ),
    },
    {
      id: "project",
      header: pw.colProject,
      primary: true,
      cell: (r) => (
        <>
          {r.title}
          <code dir="ltr" className="a-hint block">
            /{r.slug}
          </code>
        </>
      ),
    },
    { id: "year", header: pw.colYear, width: "6rem", cell: (r) => <span dir="ltr">{r.year}</span> },
    { id: "state", header: pw.colState, hideBelow: "md", width: "10rem", cell: (r) => <span dir="ltr">{r.state}</span> },
    { id: "he", header: pw.colHebrew, hideBelow: "sm", width: "6rem", cell: (r) => <HeGlyph status={heStatus(r)} /> },
  ];
  return (
    <>
      {canAdd && (
        <p className="mb-3 flex justify-end">
          <button type="button" className="a-btn a-btn-ghost min-h-11 rounded-[var(--a-r-ctl)] md:min-h-8" onClick={onAdd}>
            <Icon icon={ICON.add} aria-hidden="true" />
            {pw.add}
          </button>
        </p>
      )}
      <DataTable<Project>
        label={pw.listLabel}
        rows={items}
        columns={columns}
        rowKey={(r) => String(at(r))}
        rowLabel={(r) => r.title}
        words={words}
        density="comfortable"
        toolbar={false}
        onOpen={(r) => onOpen(at(r))}
        empty={<EmptyState variant="first-use" title={pw.none} action={{ label: pw.add, onClick: onAdd }} />}
        rowActions={(r) => {
          const i = at(r);
          return (
            <RowActions
              label={r.title}
              moreLabel={w.moreActions}
              primary={{ id: "edit", icon: ICON.draft, label: pw.edit, onSelect: () => onOpen(i) }}
              actions={[
                { id: "up", icon: UP_GLYPH, label: pw.up, disabled: i === 0, onSelect: () => onMove(r, i - 1) },
                { id: "down", icon: ICON.expand, label: pw.down, disabled: i === items.length - 1, onSelect: () => onMove(r, i + 1) },
                { id: "remove", icon: ICON.delete, label: pw.remove, tone: "danger", onSelect: () => onRemove(i) },
              ]}
            />
          );
        }}
      />
    </>
  );
}

/** Move up is the expand chevron turned over: the concept map has one chevron and no arrows. */
const UP_GLYPH = ((props: { className?: string }) => <Icon {...props} icon={ICON.expand} className={`${props.className ?? ""} rotate-180`} />) as unknown as IconProps["icon"];
