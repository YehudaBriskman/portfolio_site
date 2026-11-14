import { Link } from "react-router-dom";
import PageShell from "@/components/PageShell";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useContent } from "@/content/store";
import { sectionVisible } from "@/settings/schema";
import { useSiteSettings } from "@/settings/store";
import { useLang } from "@/components/dashboard/i18n";
import { useStatementWords } from "@/i18n/statement";
import { dateIn } from "@/i18n/words";

/*
 * The accessibility statement (issue #99).
 *
 * WHY THERE IS ONE
 *
 * Israeli law asks a site that serves the public for a statement under
 * regulation 35ה of the Service Accessibility Regulations: what was done, and
 * how to report what was not. Whether a personal portfolio is a "service" in
 * the regulation's sense, and whether its operator falls under a turnover
 * exemption in 35ו, is a legal question this file does not answer. It is
 * published anyway because it costs one route, because the reporting channel
 * it names is worth having whatever the law says, and because the issue asked
 * for a visible, reachable statement of what the Pause control does — which
 * belongs here rather than in a tooltip that only a pointer or a focus ring
 * ever opens.
 *
 * WHAT THE OWNER STILL HAS TO CONFIRM
 *
 * The reporting address is the one the footer and the contact section
 * already publish; nothing new is invented. No accessibility coordinator is
 * named: section 19מב of the Act requires one only of an operator with at
 * least 25 employees, and this site has one author. If either changes, this
 * is the one file to edit. The date below is the audit's, and moves when the
 * audit in `docs/accessibility/audit.md` is re-run.
 *
 * WHAT IT DELIBERATELY DOES NOT SAY
 *
 * "Fully compliant", or a badge. The audit is the author's, not a certified
 * accessibility expert's, and the page says so — a statement that overclaims
 * is worse than none, because it is the one page a reader who is already
 * having trouble will trust.
 */

/* The audit's date, printed in the reader's language. */
const REVIEWED = "2026-11-02";

export default function Accessibility() {
  const w = useStatementWords();
  const lang = useLang();
  useDocumentTitle(w.title);
  const { contact } = useContent().site;
  /* The form lives on the home page; hidden there (#254), it is not offered. */
  const contactShown = sectionVisible(useSiteSettings(), "contact");
  const reviewed = dateIn(lang, `${REVIEWED}T12:00:00Z`, { day: "numeric", month: "long", year: "numeric" });

  return (
    <PageShell>
      <section className="wrap section-y page-first">
        <div className="title-pair">
          <p className="eyebrow">{w.eyebrow}</p>
          <h1 className="display mt-3 text-section">{w.title}</h1>
        </div>

        <div className="mt-8 max-w-[36em] space-y-5 text-[1.0625rem] leading-relaxed text-ink">
          <p>{w.intro(reviewed)}</p>

          <h2 className="display display-md pt-6 text-object">{w.inPlace}</h2>
          <ul className="list-disc space-y-2 ps-6">
            {w.inPlaceItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h2 className="display display-md pt-6 text-object">{w.motion}</h2>
          <p>{w.motionBody}</p>
          <ul className="list-disc space-y-2 ps-6">
            <li>{w.reduceMotion}</li>
            <li>
              {w.pauseBefore} <strong>{w.pauseName}</strong> {w.pauseAfter}
            </li>
          </ul>
          <p>{w.noFlash}</p>

          <h2 className="display display-md pt-6 text-object">{w.looks}</h2>
          <p>{w.looksBody}</p>
          <ul className="list-disc space-y-2 ps-6">
            {w.looksItems.map(([name, text]) => (
              <li key={name}>
                <strong>{name}</strong> {text}
              </li>
            ))}
          </ul>

          <h2 className="display display-md pt-6 text-object">{w.sharing}</h2>
          <p>{w.sharingBody}</p>
          <ul className="list-disc space-y-2 ps-6">
            {w.sharingItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h2 id="privacy" className="display display-md scroll-mt-24 pt-6 text-object">{w.privacy}</h2>
          <p>
            <Link className="underline underline-offset-4" to="/privacy">
              {w.privacyMore}
            </Link>
          </p>

          <h2 className="display display-md pt-6 text-object">{w.limits}</h2>
          <ul className="list-disc space-y-2 ps-6">
            {w.limitItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h2 className="display display-md pt-6 text-object">{w.report}</h2>
          <p>
            {w.reportBefore}{" "}
            <a className="underline underline-offset-4" href={`mailto:${contact.email}`} dir="ltr">
              {contact.email}
            </a>
            {contactShown ? (
              <>
                {" "}
                {w.reportOr}
                {lang === "en" && " "}
                <Link className="underline underline-offset-4" to="/#contact">
                  {w.reportForm}
                </Link>
              </>
            ) : null}
            {w.reportAfter}
          </p>

          <p className="mono pt-6 text-xs text-clay">{w.updated(reviewed)}</p>
        </div>
      </section>
    </PageShell>
  );
}
