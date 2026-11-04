import EditorFrame from "@/components/admin/content/EditorFrame";
import { useContentEditor } from "@/components/admin/content/editor";
import { LinesField, ListField, NumberField, PlainField, SelectField, Section, TextField } from "@/components/admin/content/Fields";
import { SiteCopySchema, type SiteCopy, type Text } from "@/content/schema";
import TranslationPill from "@/components/admin/TranslationPill";
import { useTranslationStatus } from "@/services/translations";

/*
 * /admin/site-copy (#163): the words around the work — the hero, How I work,
 * the contact plate, the profiles and the footer.
 *
 * The role line under How I work is not here on purpose: it is "technical
 * team lead" and nothing that names where (see the employer rule in
 * `data/site.ts`), and a field would invite exactly that edit.
 */

const req = (t: Text | null): Text => t ?? { en: "" };
const ICONS = ["Github", "Linkedin"] as const;

export default function AdminSiteCopy() {
  const editor = useContentEditor<SiteCopy>("site-copy", SiteCopySchema);
  const e = editor.edit;
  const heStatus = useTranslationStatus();

  return (
    <EditorFrame
      title="Site copy"
      section="site-copy"
      intro="The hero, How I work, the contact plate, the profiles and the footer. English is required; Hebrew is optional and falls back to English."
      preview="/?preview=1"
      editor={editor}
    >
      {(c) => (
        <>
          <Section title="Hero" aside={<TranslationPill status={heStatus("site-copy", "hero")} />}>
            <div className="grid gap-4 sm:grid-cols-2">
              <PlainField id="site-hero-name" path="hero.name" label="Name" value={c.hero.name} onChange={(v) => e((d) => void (d.hero.name = v))} />
              <NumberField id="site-hero-since" path="hero.shippingSince" label="Shipping since" value={c.hero.shippingSince} onChange={(n) => e((d) => void (d.hero.shippingSince = n))} />
            </div>
            <TextField id="site-hero-title" path="hero.title" label="Title" value={c.hero.title} onChange={(t) => e((d) => void (d.hero.title = req(t)))} />
            <TextField id="site-hero-fact" path="hero.fact" label="Fact" value={c.hero.fact} onChange={(t) => e((d) => void (d.hero.fact = req(t)))} />
            <TextField id="site-hero-where" path="hero.where" label="Where" value={c.hero.where} onChange={(t) => e((d) => void (d.hero.where = req(t)))} />
            <ListField
              id="site-hero-phrases"
              path="hero.phrases"
              legend="Phrases beside the light"
              items={c.hero.phrases}
              name={(p) => p.en || "New phrase"}
              make={() => ({ en: "" })}
              max={8}
              addLabel="Add a phrase"
              onChange={(next) => e((d) => void (d.hero.phrases = next))}
            >
              {(p, i) => <TextField id={`site-hero-phrases-${i}`} path={`hero.phrases.${i}`} label={`Phrase ${i + 1}`} value={p} onChange={(t) => e((d) => void (d.hero.phrases[i] = req(t)))} />}
            </ListField>
          </Section>

          <Section title="How I work" aside={<TranslationPill status={heStatus("site-copy", "about")} />}>
            <TextField id="site-about-heading" path="about.heading" label="Heading" value={c.about.heading} onChange={(t) => e((d) => void (d.about.heading = req(t)))} />
            <ListField
              id="site-about-intro"
              path="about.intro"
              legend="Sections"
              items={c.about.intro}
              name={(s) => s.label.en || "New section"}
              make={() => ({ label: { en: "" }, lines: [{ en: "" }] })}
              max={8}
              addLabel="Add a section"
              onChange={(next) => e((d) => void (d.about.intro = next))}
            >
              {(s, i) => (
                <>
                  <TextField id={`site-about-intro-${i}-label`} path={`about.intro.${i}.label`} label="Label" value={s.label} onChange={(t) => e((d) => void (d.about.intro[i].label = req(t)))} />
                  <LinesField id={`site-about-intro-${i}-lines`} path={`about.intro.${i}.lines`} legend="Lines" lines={s.lines} onChange={(next) => e((d) => void (d.about.intro[i].lines = next))} />
                </>
              )}
            </ListField>
            <ListField
              id="site-about-principles"
              path="about.principles"
              legend="Principles"
              hint="A principle's figure is drawn for its English claim; a new claim gets no figure until one is drawn."
              items={c.about.principles}
              name={(p) => p.claim.en || "New principle"}
              make={() => ({ claim: { en: "" }, lines: [{ en: "" }] })}
              max={8}
              addLabel="Add a principle"
              onChange={(next) => e((d) => void (d.about.principles = next))}
            >
              {(p, i) => (
                <>
                  <TextField id={`site-about-principles-${i}-claim`} path={`about.principles.${i}.claim`} label="Claim" value={p.claim} onChange={(t) => e((d) => void (d.about.principles[i].claim = req(t)))} />
                  <LinesField id={`site-about-principles-${i}-lines`} path={`about.principles.${i}.lines`} legend="Lines" lines={p.lines} onChange={(next) => e((d) => void (d.about.principles[i].lines = next))} />
                </>
              )}
            </ListField>
          </Section>

          <Section title="Contact" aside={<TranslationPill status={heStatus("site-copy", "contact")} />}>
            <PlainField id="site-contact-email" path="contact.email" label="Email" type="email" mono dir="ltr" value={c.contact.email} onChange={(v) => e((d) => void (d.contact.email = v))} />
            <TextField id="site-contact-location" path="contact.location" label="Location" value={c.contact.location} onChange={(t) => e((d) => void (d.contact.location = req(t)))} />
            <TextField id="site-contact-availability" path="contact.availability" label="Availability" value={c.contact.availability} onChange={(t) => e((d) => void (d.contact.availability = req(t)))} />
            <TextField id="site-contact-reply" path="contact.replyWithin" label="Reply within" value={c.contact.replyWithin} onChange={(t) => e((d) => void (d.contact.replyWithin = req(t)))} />
          </Section>

          <Section title="Profiles">
            <ListField
              id="site-profiles"
              path="profiles"
              legend="In the nav and the footer"
              items={c.profiles}
              name={(p) => p.name || "New profile"}
              make={() => ({ name: "", url: "", icon: "Github" as const, label: "" })}
              max={4}
              addLabel="Add a profile"
              onChange={(next) => e((d) => void (d.profiles = next))}
            >
              {(p, i) => (
                <div className="grid gap-4 sm:grid-cols-2">
                  <PlainField id={`site-profiles-${i}-name`} path={`profiles.${i}.name`} label="Name" mono dir="ltr" value={p.name} onChange={(v) => e((d) => void (d.profiles[i].name = v))} />
                  <SelectField id={`site-profiles-${i}-icon`} path={`profiles.${i}.icon`} label="Mark" value={p.icon} options={ICONS} onChange={(v) => e((d) => void (d.profiles[i].icon = v))} />
                  <PlainField id={`site-profiles-${i}-url`} path={`profiles.${i}.url`} label="URL" type="url" mono dir="ltr" value={p.url} onChange={(v) => e((d) => void (d.profiles[i].url = v))} />
                  <PlainField id={`site-profiles-${i}-label`} path={`profiles.${i}.label`} label="Accessible name" value={p.label} onChange={(v) => e((d) => void (d.profiles[i].label = v))} />
                </div>
              )}
            </ListField>
          </Section>

          <Section title="Footer" aside={<TranslationPill status={heStatus("site-copy", "footer")} />}>
            <ListField
              id="site-footer-work"
              path="footer.work"
              legend="Work links"
              items={c.footer.work}
              name={(w) => w.label.en || "New link"}
              make={() => ({ label: { en: "" }, url: "", note: { en: "" } })}
              max={6}
              addLabel="Add a link"
              onChange={(next) => e((d) => void (d.footer.work = next))}
            >
              {(w, i) => (
                <>
                  <TextField id={`site-footer-work-${i}-label`} path={`footer.work.${i}.label`} label="Label" value={w.label} onChange={(t) => e((d) => void (d.footer.work[i].label = req(t)))} />
                  <PlainField id={`site-footer-work-${i}-url`} path={`footer.work.${i}.url`} label="URL" type="url" mono dir="ltr" value={w.url} onChange={(v) => e((d) => void (d.footer.work[i].url = v))} />
                  <TextField id={`site-footer-work-${i}-note`} path={`footer.work.${i}.note`} label="Note" value={w.note} onChange={(t) => e((d) => void (d.footer.work[i].note = req(t)))} />
                </>
              )}
            </ListField>
            <TextField id="site-footer-colophon" path="footer.colophon" label="Colophon" multiline value={c.footer.colophon} onChange={(t) => e((d) => void (d.footer.colophon = req(t)))} />
            <TextField id="site-footer-colophon-note" path="footer.colophonNote" label="Colophon note" value={c.footer.colophonNote} onChange={(t) => e((d) => void (d.footer.colophonNote = req(t)))} />
            <TextField id="site-footer-place" path="footer.place" label="Place" value={c.footer.place} onChange={(t) => e((d) => void (d.footer.place = req(t)))} />
          </Section>
        </>
      )}
    </EditorFrame>
  );
}
