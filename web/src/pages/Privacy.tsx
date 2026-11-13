import { Link } from "react-router-dom";
import PageShell from "@/components/PageShell";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useContent } from "@/content/store";
import { useLang } from "@/components/dashboard/i18n";
import { usePrivacyWords } from "@/i18n/privacy";
import { dateIn } from "@/i18n/words";

/*
 * The privacy page (#586).
 *
 * A plain statement, written to be read once: what the mailing list and the
 * contact form keep, why, for how long, who handles it, and how to ask. The
 * words are in i18n/privacy.ts and every claim in them is checked against the
 * code in the pull request that added them; edit a claim and the date below
 * with it.
 *
 * The three provider names are brand names and stay in Latin letters in both
 * languages, so they live here and not in the Hebrew table; each is set apart
 * (`bdi`, `lang="en"`) so a right-to-left sentence cannot reorder it. The
 * contact address is the one the footer and the accessibility statement
 * already publish. There is no postal address: none exists to publish.
 */

/* The day the wording was last changed. */
const UPDATED = "2026-11-13";

/* Index-aligned with `providers` in the words table. */
const PROVIDER_NAMES = ["Resend", "Cloudflare", "Google"] as const;

export default function Privacy() {
  const w = usePrivacyWords();
  const lang = useLang();
  useDocumentTitle(w.title);
  const { contact } = useContent().site;
  const updated = dateIn(lang, `${UPDATED}T12:00:00Z`, { day: "numeric", month: "long", year: "numeric" });

  const list = (items: readonly string[]) => (
    <ul className="list-disc space-y-2 ps-6">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
  const h2 = "display display-md pt-6 text-object";

  return (
    <PageShell>
      <section className="wrap section-y">
        <p className="eyebrow">{w.eyebrow}</p>
        <h1 className="display mt-3 text-section">{w.title}</h1>
        <p className="mono mt-3 text-xs text-clay">{w.updated(updated)}</p>

        <div className="mt-8 max-w-[36em] space-y-5 text-[1.0625rem] leading-relaxed text-ink">
          <p>{w.intro}</p>

          {w.sections.map((s) => (
            <section key={s.heading} className="space-y-5">
              <h2 className={h2}>{s.heading}</h2>
              {s.intro ? <p>{s.intro}</p> : null}
              {list(s.items)}
            </section>
          ))}

          <h2 className={h2}>{w.howLongHeading}</h2>
          {list(w.howLong)}

          <h2 className={h2}>{w.whoHeading}</h2>
          <p>{w.whoIntro}</p>
          <ul className="list-disc space-y-2 ps-6">
            {w.providers.map((text, i) => (
              <li key={PROVIDER_NAMES[i]}>
                <strong>
                  <bdi lang="en" dir="ltr">
                    {PROVIDER_NAMES[i]}
                  </bdi>
                </strong>{" "}
                {text}
              </li>
            ))}
          </ul>
          <p>{w.whoOutro}</p>

          <h2 className={h2}>{w.contactHeading}</h2>
          {list(w.contact)}

          <h2 className={h2}>{w.trackingHeading}</h2>
          {list(w.tracking)}

          <h2 className={h2}>{w.rightsHeading}</h2>
          <p>{w.rightsIntro}</p>
          {list(w.rights)}
          <p>
            {w.rightsBefore}{" "}
            <a className="underline underline-offset-4" href={`mailto:${contact.email}`} dir="ltr">
              {contact.email}
            </a>{" "}
            {w.rightsAfter}
          </p>

          <p>{w.changes}</p>
          <p>
            <Link className="underline underline-offset-4" to="/follow">
              {w.back}
            </Link>
          </p>
        </div>
      </section>
    </PageShell>
  );
}
