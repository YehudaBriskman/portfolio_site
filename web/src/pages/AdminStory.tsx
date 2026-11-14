import EditorFrame from "@/components/admin/content/EditorFrame";
import MediaPicker from "@/components/admin/MediaPicker";
import { useContentEditor } from "@/components/admin/content/editor";
import { LangSwitch } from "@/components/admin/content/editLang";
import { LinesField, ListField, PlainField, SelectField, Section, TextField } from "@/components/admin/content/Fields";
import { BEAT_LAYOUTS, beatIds, StoryContentSchema, type StoryContent, type Text } from "@/content/schema";
import { useContentBundle } from "@/content/store";
import TranslationPill from "@/components/admin/TranslationPill";
import { useTranslationStatus } from "@/services/translations";

/*
 * /admin/story (#163): the opening, the roles, and what is pinned to the
 * beats — a layout, a photograph, an interlude. A project's own line is on
 * the project, in /admin/projects, so adding a project and its beat is one
 * edit.
 *
 * Beats are named by id. The pickers offer the ids the story has right now
 * (the start, each project by slug, each role), and the publish check refuses
 * an id that names no beat, the way the build used to.
 */

const req = (t: Text | null): Text => t ?? { en: "" };

type Layout = (typeof BEAT_LAYOUTS)[number];
type Pinned<V> = { beat: string; value: V };

const rows = <V,>(record: Record<string, V>): Pinned<V>[] =>
  Object.entries(record).map(([beat, value]) => ({ beat, value }));
const record = <V,>(list: Pinned<V>[]): Record<string, V> =>
  Object.fromEntries(list.map((r) => [r.beat, r.value]));

export default function AdminStory() {
  const editor = useContentEditor<StoryContent>("story", StoryContentSchema);
  const bundle = useContentBundle();
  const heStatus = useTranslationStatus();

  return (
    <EditorFrame
      title="Story"
      section="story"
      intro="The page at /story. English is required; Hebrew is optional and falls back to English, except in an interlude, which is written in both."
      preview="/story?preview=1"
      editor={editor}
      focus={(v, field, q) => {
        const i = v.roles.findIndex((r) => r.id === q.get("role"));
        return i < 0 ? field : `roles.${i}.${field}`;
      }}
    >
      {(story) => {
        const beats = beatIds({ ...bundle, story });
        const options = (current: string) => (beats.includes(current) ? beats : [current, ...beats]);
        const firstFree = (used: string[]) => beats.find((b) => !used.includes(b)) ?? beats[0] ?? "";
        const layoutRows = rows(story.layouts);
        const imageRows = rows(story.images);

        return (
          <>
            <LangSwitch />
            <Section title="The opening" defaultOpen aside={<TranslationPill status={heStatus("story", "start")} />}>
              <TextField id="story-start-title" path="start.title" label="Title" value={story.start.title} onChange={(t) => editor.edit((d) => void (d.start.title = req(t)))} />
              <LinesField id="story-start-lines" path="start.lines" legend="Lines" lines={story.start.lines} onChange={(next) => editor.edit((d) => void (d.start.lines = next))} />
            </Section>

            <Section title="Roles">
              <ListField
                id="story-roles"
                path="roles"
                legend="In the order they come after the projects"
                items={story.roles}
                name={(r) => r.title.en || r.id}
                make={() => ({ id: "new-role", when: { en: "" }, title: { en: "" }, lines: [{ en: "" }] })}
                max={12}
                addLabel="Add a role"
                onChange={(next) => editor.edit((d) => void (d.roles = next))}
              >
                {(r, i) => (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <TranslationPill status={heStatus("story", `role:${r.id}`)} className="justify-self-start sm:col-span-2" />
                      <PlainField id={`story-roles-${i}-id`} path={`roles.${i}.id`} label="Id" mono dir="ltr" value={r.id} onChange={(v) => editor.edit((d) => void (d.roles[i].id = v))} />
                    </div>
                    <TextField id={`story-roles-${i}-when`} path={`roles.${i}.when`} label="When" value={r.when} onChange={(t) => editor.edit((d) => void (d.roles[i].when = req(t)))} />
                    <TextField id={`story-roles-${i}-title`} path={`roles.${i}.title`} label="Title" value={r.title} onChange={(t) => editor.edit((d) => void (d.roles[i].title = req(t)))} />
                    <LinesField id={`story-roles-${i}-lines`} path={`roles.${i}.lines`} legend="Lines" lines={r.lines} onChange={(next) => editor.edit((d) => void (d.roles[i].lines = next))} />
                  </>
                )}
              </ListField>
            </Section>

            <Section title="Pinned to beats">
              <ListField
                id="story-layouts"
                path="layouts"
                legend="Layouts"
                hint="How a beat's photograph sits beside its text. A beat with none uses the default."
                items={layoutRows}
                name={(r) => r.beat}
                make={() => ({ beat: firstFree(layoutRows.map((r) => r.beat)), value: "beside" as Layout })}
                addLabel="Add a layout"
                onChange={(next) => editor.edit((d) => void (d.layouts = record(next)))}
              >
                {(r, i) => (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SelectField id={`story-layouts-${i}-beat`} path={`layouts.${r.beat}`} label="Beat" value={r.beat} options={options(r.beat)} onChange={(v) => editor.edit((d) => void (d.layouts = record(layoutRows.map((x, j) => (j === i ? { ...x, beat: v } : x)))))} />
                    <SelectField id={`story-layouts-${i}-value`} path={`layouts.${r.beat}.value`} label="Layout" value={r.value} options={BEAT_LAYOUTS} onChange={(v) => editor.edit((d) => void (d.layouts[r.beat] = v))} />
                  </div>
                )}
              </ListField>

              <ListField
                id="story-images"
                path="images"
                legend="Photographs"
                items={imageRows}
                name={(r) => r.beat}
                make={() => ({ beat: firstFree(imageRows.map((r) => r.beat)), value: { src: "", alt: { en: "" } } })}
                addLabel="Add a photograph"
                onChange={(next) => editor.edit((d) => void (d.images = record(next)))}
              >
                {(r, i) => (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <SelectField id={`story-images-${i}-beat`} path={`images.${r.beat}`} label="Beat" value={r.beat} options={options(r.beat)} onChange={(v) => editor.edit((d) => void (d.images = record(imageRows.map((x, j) => (j === i ? { ...x, beat: v } : x)))))} />
                      <div className="min-w-0">
                        <PlainField id={`story-images-${i}-src`} path={`images.${r.beat}.src`} label="Image" mono dir="ltr" hint="A picture from the library, /img/… or https://…" value={r.value.src} onChange={(v) => editor.edit((d) => void (d.images[r.beat].src = v))} />
                        <MediaPicker value={r.value.src} onChange={(url) => editor.edit((d) => void (d.images[r.beat].src = url))} />
                      </div>
                    </div>
                    <TextField id={`story-images-${i}-alt`} path={`images.${r.beat}.alt`} label="Alt text" value={r.value.alt} onChange={(t) => editor.edit((d) => void (d.images[r.beat].alt = req(t)))} />
                  </>
                )}
              </ListField>

              <ListField
                id="story-interludes"
                path="interludes"
                legend="Interludes"
                hint="A short phrase between two beats, written in both languages."
                items={story.interludes}
                name={(l) => l.words.en || l.id}
                make={() => ({ id: "new-interlude", after: beats[0] ?? "", words: { en: "", he: "" } })}
                max={12}
                addLabel="Add an interlude"
                onChange={(next) => editor.edit((d) => void (d.interludes = next))}
              >
                {(l, i) => (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <PlainField id={`story-interludes-${i}-id`} path={`interludes.${i}.id`} label="Id" mono dir="ltr" value={l.id} onChange={(v) => editor.edit((d) => void (d.interludes[i].id = v))} />
                      <SelectField id={`story-interludes-${i}-after`} path={`interludes.${i}.after`} label="After beat" value={l.after} options={options(l.after)} onChange={(v) => editor.edit((d) => void (d.interludes[i].after = v))} />
                    </div>
                    <TextField
                      id={`story-interludes-${i}-words`}
                      path={`interludes.${i}.words`}
                      label="Words"
                      value={l.words}
                      onChange={(t) => editor.edit((d) => void (d.interludes[i].words = { en: t?.en ?? "", he: t?.he ?? "" }))}
                    />
                  </>
                )}
              </ListField>
            </Section>
          </>
        );
      }}
    </EditorFrame>
  );
}
