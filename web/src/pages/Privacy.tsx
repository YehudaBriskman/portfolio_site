import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";
import PageShell from "@/components/PageShell";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useContent } from "@/content/store";
import { useLang } from "@/components/dashboard/i18n";
import { usePrivacyWords } from "@/i18n/privacy";
import { dateIn } from "@/i18n/words";
import "@/components/phone/tokens.css";
import "@/components/phone/pages-forms.css";
import { Mail } from "lucide-react";
import GroupedSection from "@/components/phone/GroupedSection";
import ListRow from "@/components/phone/ListRow";

/*
 * The privacy page (#586).
 *
 * A plain statement, written to be read once: what the mailing list and the
 * contact form keep, why, for how long, who handles it, and how to ask. The
 * words are in i18n/privacy.ts and every claim in them is checked against the
 * code in the pull request that added them; edit a claim and the date below
 * with it.
 *
 * The provider names are brand names and stay in Latin letters in both
 * languages, so they live here and not in the Hebrew table; each is set apart
 * (`bdi`, `lang="en"`) so a right-to-left sentence cannot reorder it. The
 * contact address is the one the footer and the accessibility statement
 * already publish. There is no postal address: none exists to publish.
 */

/* The day the wording was last changed. */
const UPDATED = "2026-11-13";

/* What `{1}`..`{4}` stand for in the words; `{0}` is the contact address. */
const NAMES = ["", "Oracle Cloud", "Resend", "Cloudflare", "Google"] as const;

export default function Privacy() {
  const w = usePrivacyWords();
  const lang = useLang();
  useDocumentTitle(w.title);
  const { contact } = useContent().site;
  const updated = dateIn(lang, `${UPDATED}T12:00:00Z`, { day: "numeric", month: "long", year: "numeric" });

  const fill = (text: string): ReactNode[] =>
    text.split(/\{(\d)\}/).map((part, i) => {
      if (i % 2 === 0) return part;
      const n = Number(part);
      return (
        <Fragment key={i}>
          {n === 0 ? (
            <a className="underline underline-offset-4" href={`mailto:${contact.email}`} dir="ltr">
              {contact.email}
            </a>
          ) : (
            <strong>
              <bdi lang="en" dir="ltr">
                {NAMES[n]}
              </bdi>
            </strong>
          )}
        </Fragment>
      );
    });

  return (
    <PageShell>
      <section className="wrap section-y page-first">
        <div className="title-pair">
          <p className="eyebrow">{w.eyebrow}</p>
          <h1 className="display mt-3 text-section">{w.title}</h1>
        </div>
        <p className="mono mt-3 text-xs text-clay">{w.updated(updated)}</p>

        <div className="mt-8 max-w-[36em] space-y-5 text-[1.0625rem] leading-relaxed text-ink">
          <p>{fill(w.intro)}</p>
          {w.sections.map((s) => (
            <section key={s.heading} className="space-y-3">
              <h2 className="display display-md pt-6 text-object">{s.heading}</h2>
              <p>{fill(s.body)}</p>
            </section>
          ))}
          <GroupedSection>
            <ul className="mt-5">
              <li>
                <ListRow to="/follow" icon={<Mail data-ph-only="" aria-hidden="true" />} tone="blue" className="underline underline-offset-4">
                  <span>{w.back}</span>
                </ListRow>
              </li>
            </ul>
          </GroupedSection>
        </div>
      </section>
    </PageShell>
  );
}
