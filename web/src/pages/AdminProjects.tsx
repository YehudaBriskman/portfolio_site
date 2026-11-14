import { useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import TranslationPill from "@/components/admin/TranslationPill";
import { useTranslationStatus, type TranslationStatus } from "@/services/translations";
import { usePhone } from "@/hooks/usePhone";
import { RecordRow } from "@/components/ui/RecordRow";
import { StatusGlyph } from "@/components/ui/StatusGlyph";
import { ICON } from "@/components/ui/icons";
import { Pencil } from "lucide-react";
import { LangSwitch } from "@/components/admin/content/editLang";
import { ReorderRows, ReorderToggle } from "@/components/admin/content/Reorder";
import { useContentWords } from "@/components/admin/content/words";
import styles from "@/components/admin/content/EditorPhone.module.css";
import EditorFrame from "@/components/admin/content/EditorFrame";
import MediaPicker from "@/components/admin/MediaPicker";
import { useContentEditor } from "@/components/admin/content/editor";
import {
  ListField,
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
  /* Null until the owner picks one: then `?project=windom` (a Translations row, #302) decides. */
  const [picked, setPicked] = useState<number | null>(null);
  const heStatus = useTranslationStatus();
  const [query] = useSearchParams();
  const wanted = query.get("project");
  const phone = usePhone();
  const w = useContentWords();
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
        const at = Math.min(picked ?? Math.max(fromQuery, 0), items.length - 1);
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
        };

        /* The fields, made once. The desktop lays them out as four sections; a
           phone as four groups (Basics, Links, Media, Details), so a field is
           drawn in exactly one place either way and writes the same payload. */
        const f = p && {
          title: <PlainField id="project-title" path={`${base}.title`} label="Title" value={p.title} onChange={(v) => set((d) => void (d.title = v))} />,
          slug: <PlainField id="project-slug" path={`${base}.slug`} label="Slug" mono dir="ltr" hint="The address: /projects/<slug>" value={p.slug} onChange={(v) => set((d) => void (d.slug = v))} />,
          year: <PlainField id="project-year" path={`${base}.year`} label="Year" mono dir="ltr" value={p.year} onChange={(v) => set((d) => void (d.year = v))} />,
          state: <PlainField id="project-state" path={`${base}.state`} label="State" hint="A key: live, in-use, open-source, in-progress, released or archive. Or a release tag (v1.2.0). The site shows a word for it in each language." value={p.state} onChange={(v) => set((d) => void (d.state = v))} />,
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
                <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
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
              <legend className="a-label">Tint (red, green, blue: 0 to 255)</legend>
              <div className="grid grid-cols-3 gap-3">
                {(["Red", "Green", "Blue"] as const).map((c, i) => (
                  <NumberField key={c} id={`project-tint-${i}`} path={`${base}.tint.${i}`} label={c} value={p.tint[i] as number} onChange={(n) => set((d) => void (d.tint[i] = n))} />
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
                Preview this project ↗
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
                addLabel="Add a project"
                canAdd={items.length < 60}
                make={() => blank(items.length)}
              />
              {p && f && (
                <div className="min-w-0">
                  <h2 id="project-editing" className="a-h2 mt-6 scroll-mt-20" tabIndex={-1}>
                    {w.reorder.editing}: <bdi>{p.title || "Untitled"}</bdi>
                  </h2>
                  <LangSwitch />
                  <Section title={w.group.basics} defaultOpen>
                    <div className="grid gap-4">
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

        return (
          <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <div className="min-w-0">
              <ListField
                id="projects-list"
                path="items"
                legend="Order on the site"
                items={items}
                name={(item) => item.title}
                make={() => blank(items.length)}
                max={60}
                addLabel="Add a project"
                onChange={changeList}
              >
                {(item, i) => (
                  <span className="flex min-w-0 items-center gap-2">
                  <TranslationPill status={heStatus("project", item.slug)} />
                  <button
                    type="button"
                    className={`a-btn min-h-11 w-full min-w-0 justify-start rounded-[var(--a-r-ctl)] md:min-h-8 ${i === at ? "a-btn-primary" : "a-btn-ghost"}`}
                    aria-pressed={i === at}
                    aria-label={`Edit ${item.title}`}
                    onClick={() => setPicked(i)}
                  >
                    Edit
                  </button>
                  </span>
                )}
              </ListField>
            </div>

            {p && f && (
              <div className="min-w-0">
                <Section title={p.title || "Untitled"}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {f.title}
                    {f.slug}
                    {f.year}
                    {f.state}
                  </div>
                  {f.fact}
                  {f.description}
                  {f.status}
                  {f.storyLine}
                </Section>

                <Section title="Card">
                  {f.cardFields}
                  {f.tech}
                  {f.image}
                  {f.tint}
                </Section>

                <Section title="Links">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {f.link}
                    {f.linkLabel}
                    {f.github}
                  </div>
                  {f.links}
                </Section>

                <Section title="The case">
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
  return (
    <section aria-labelledby="projects-list-title">
      <div className={styles.listHead}>
        <h2 id="projects-list-title" className={styles.listTitle}>
          {w.reorder.list}
        </h2>
        {items.length > 1 && <ReorderToggle on={reordering} onToggle={() => onReordering(!reordering)} />}
      </div>
      {reordering ? (
        <ReorderRows items={items} name={(item) => item.title} onChange={onChange} />
      ) : (
        <ul className={styles.list}>
          {items.map((item, i) => {
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
                trailing={current ? <Pencil size={16} aria-hidden="true" focusable="false" /> : "chevron"}
                openLabel={w.reorder.edit(item.title)}
                onOpen={() => onPick(i)}
              />
            );
          })}
        </ul>
      )}
      {canAdd && !reordering && (
        <button type="button" className="a-btn a-btn-ghost mt-3 min-h-11 rounded-[var(--a-r-ctl)]" onClick={() => onChange([...items, make()])}>
          {addLabel}
        </button>
      )}
    </section>
  );
}
