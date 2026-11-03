import { useState } from "react";
import EditorFrame from "@/components/admin/content/EditorFrame";
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
  const [picked, setPicked] = useState(0);

  return (
    <EditorFrame
      title="Projects"
      section="projects"
      intro="The projects on the home page, the work page and each project page. English is required; Hebrew is optional and falls back to English. Images are paths or https URLs."
      preview="/projects?preview=1"
      editor={editor}
    >
      {(content) => {
        const items = content.items;
        const at = Math.min(picked, items.length - 1);
        const p = items[at];
        const base = `items.${at}`;
        const set = (change: (draft: Project) => void) => editor.edit((d) => change(d.items[at]));
        /* The order field follows the list, so moving a row is the whole act. */
        const reorder = (next: Project[]) =>
          editor.edit((d) => {
            d.items = next.map((item, i) => ({ ...item, order: i }));
          });

        return (
          <div className="mt-8 grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <div>
              <ListField
                id="projects-list"
                path="items"
                legend="Order on the site"
                items={items}
                name={(item) => item.title}
                make={() => blank(items.length)}
                max={60}
                addLabel="Add a project"
                onChange={(next) => {
                  reorder(next);
                  if (next.length > items.length) setPicked(next.length - 1);
                }}
              >
                {(item, i) => (
                  <button
                    type="button"
                    className={`a-btn w-full justify-start ${i === at ? "a-btn-primary" : "a-btn-ghost"}`}
                    aria-pressed={i === at}
                    aria-label={`Edit ${item.title}`}
                    onClick={() => setPicked(i)}
                  >
                    Edit
                  </button>
                )}
              </ListField>
            </div>

            {p && (
              <div className="min-w-0">
                <Section title={p.title || "Untitled"}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <PlainField id="project-title" path={`${base}.title`} label="Title" value={p.title} onChange={(v) => set((d) => void (d.title = v))} />
                    <PlainField id="project-slug" path={`${base}.slug`} label="Slug" mono dir="ltr" hint="The address: /projects/<slug>" value={p.slug} onChange={(v) => set((d) => void (d.slug = v))} />
                    <PlainField id="project-year" path={`${base}.year`} label="Year" mono dir="ltr" value={p.year} onChange={(v) => set((d) => void (d.year = v))} />
                    <PlainField id="project-state" path={`${base}.state`} label="State" hint="Live, Released, In progress, Archived…" value={p.state} onChange={(v) => set((d) => void (d.state = v))} />
                  </div>
                  <TextField id="project-fact" path={`${base}.fact`} label="One-line fact" value={p.fact} onChange={(t) => set((d) => void (d.fact = req(t)))} />
                  <TextField id="project-description" path={`${base}.description`} label="Description" multiline value={p.description} onChange={(t) => set((d) => void (d.description = req(t)))} />
                  <TextField id="project-status" path={`${base}.status`} label="Status line" value={p.status} onChange={(t) => set((d) => void (d.status = req(t)))} />
                  <TextField id="project-story-line" path={`${base}.storyLine`} label="Line on the story page" hint="The sentence /story tells about this project." value={p.storyLine} onChange={(t) => set((d) => void (d.storyLine = req(t)))} />
                </Section>

                <Section title="Card">
                  <ListField
                    id="project-fields"
                    path={`${base}.fields`}
                    legend="Label fields (one to three)"
                    items={p.fields}
                    name={(f) => `${f.kind}: ${f.value}`}
                    make={() => ({ kind: "tech" as const, value: "" })}
                    max={3}
                    addLabel="Add a field"
                    onChange={(next) => set((d) => void (d.fields = next))}
                  >
                    {(f, i) => (
                      <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
                        <SelectField<(typeof FIELD_KINDS)[number]> id={`project-fields-${i}-kind`} path={`${base}.fields.${i}.kind`} label="Kind" value={f.kind} options={FIELD_KINDS} onChange={(v) => set((d) => void (d.fields[i].kind = v))} />
                        <PlainField id={`project-fields-${i}-value`} path={`${base}.fields.${i}.value`} label="Value" value={f.value} onChange={(v) => set((d) => void (d.fields[i].value = v))} />
                      </div>
                    )}
                  </ListField>
                  <PlainField
                    id="project-tech"
                    path={`${base}.tech`}
                    label="Tech"
                    hint="Comma-separated, in the order shown."
                    value={p.tech.join(", ")}
                    onChange={(v) => set((d) => void (d.tech = v.split(",").map((s) => s.trim()).filter(Boolean)))}
                  />
                  <PlainField id="project-image" path={`${base}.image`} label="Image" mono dir="ltr" hint="/images/… or https://…; empty for none." value={p.image ?? ""} onChange={(v) => set((d) => void (d.image = orNull(v)))} />
                  <fieldset>
                    <legend className="a-label">Tint (red, green, blue: 0 to 255)</legend>
                    <div className="grid grid-cols-3 gap-3">
                      {(["Red", "Green", "Blue"] as const).map((c, i) => (
                        <NumberField key={c} id={`project-tint-${i}`} path={`${base}.tint.${i}`} label={c} value={p.tint[i] as number} onChange={(n) => set((d) => void (d.tint[i] = n))} />
                      ))}
                    </div>
                  </fieldset>
                </Section>

                <Section title="Links">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <PlainField id="project-link" path={`${base}.link`} label="Main link" type="url" mono dir="ltr" value={p.link ?? ""} onChange={(v) => set((d) => void (d.link = orNull(v)))} />
                    <PlainField id="project-link-label" path={`${base}.linkLabel`} label="Main link label" value={p.linkLabel ?? ""} onChange={(v) => set((d) => void (d.linkLabel = orNull(v)))} />
                    <PlainField id="project-github" path={`${base}.github`} label="Repository" type="url" mono dir="ltr" value={p.github ?? ""} onChange={(v) => set((d) => void (d.github = orNull(v)))} />
                  </div>
                  <ListField
                    id="project-links"
                    path={`${base}.links`}
                    legend="More links"
                    items={p.links}
                    name={(l) => l.label || "New link"}
                    make={() => ({ label: "", url: "" })}
                    max={8}
                    addLabel="Add a link"
                    onChange={(next) => set((d) => void (d.links = next))}
                  >
                    {(l, i) => (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <PlainField id={`project-links-${i}-label`} path={`${base}.links.${i}.label`} label="Label" value={l.label} onChange={(v) => set((d) => void (d.links[i].label = v))} />
                        <PlainField id={`project-links-${i}-url`} path={`${base}.links.${i}.url`} label="URL" type="url" mono dir="ltr" value={l.url} onChange={(v) => set((d) => void (d.links[i].url = v))} />
                      </div>
                    )}
                  </ListField>
                </Section>

                <Section title="The case">
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
                  <TextField id="project-problem" path={`${base}.problem`} label="The problem" multiline nullable value={p.problem} onChange={(t) => set((d) => void (d.problem = t))} />
                  <TextField id="project-role" path={`${base}.role`} label="My role" multiline nullable value={p.role} onChange={(t) => set((d) => void (d.role = t))} />
                  <TextField id="project-outcome" path={`${base}.outcome`} label="The outcome" multiline nullable value={p.outcome} onChange={(t) => set((d) => void (d.outcome = t))} />
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
                  <p className="a-hint">
                    <a className="underline" href={`/projects/${p.slug}?preview=1`} target="_blank" rel="noreferrer">
                      Preview this project ↗
                    </a>
                  </p>
                </Section>
              </div>
            )}
          </div>
        );
      }}
    </EditorFrame>
  );
}
