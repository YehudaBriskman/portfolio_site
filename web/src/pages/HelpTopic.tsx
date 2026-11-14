import { Link, useParams } from "react-router-dom";
import PageShell from "@/components/PageShell";
import BackChip from "@/components/BackChip";
import { usePublicPhone } from "@/components/nav/localBrowse";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { sectionVisible } from "@/settings/schema";
import { useSiteSettings } from "@/settings/store";
import { useHelpWords } from "@/i18n/help";
import { HELP_TOPICS } from "@/lib/help/topics";
import { helpPageIds, helpPagePath, isHelpPage, neighbours, type HelpGuide, type HelpPage } from "@/lib/help/pages";
import { helpTitle, pagerArrow } from "@/components/help/helpRows";
import { GuideBody, OutcomeBody } from "@/components/help/HelpBody";
import { useHelpMotion } from "@/components/help/useHelpMotion";
import NotFound from "@/pages/NotFound";
import "@/components/phone/tokens.css";
import "@/components/phone/pages-info.css";
import "@/components/help/helpMotion.css";

/*
 * One help page (#803), at `/help/<id>`: a guide or an outcome topic, with
 * the way up to `/help` (the back chip on a phone, a plain breadcrumb above
 * it) and the page before and after in the index's order.
 *
 * An id that is no page, or the contact form's guide while the form is hidden
 * in the site settings, is the site's own 404. Every string is i18n/help.ts:
 * the title is the topic's existing heading and the eyebrow is the page's own
 * ("Using this site", or the topic's group).
 */

const link = "underline underline-offset-4";

function Page({ id }: { id: HelpPage }) {
  const w = useHelpWords();
  const phone = usePublicPhone();
  const contactShown = sectionVisible(useSiteSettings(), "contact");
  const title = helpTitle(w, id);
  useDocumentTitle(title);
  const { prev, next } = neighbours(id, contactShown);
  const motion = useHelpMotion(id, helpPageIds(contactShown));
  const topic = id in HELP_TOPICS ? HELP_TOPICS[id as keyof typeof HELP_TOPICS] : null;
  const eyebrow = topic ? w.groupTitles[topic.group] : w.eyebrow;

  return (
    <PageShell>
      <section key={id} className="wrap section-y page-first" {...motion}>
        {phone ? (
          <BackChip to="/help" label={w.title} gap="0px" />
        ) : (
          <nav aria-label={w.title} className="mono flex items-center gap-2 text-xs text-clay">
            <Link className={`${link} tap inline-flex min-h-6 items-center [@media(pointer:coarse)]:min-h-11`} to="/help">{w.title}</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{title}</span>
          </nav>
        )}

        <div className="title-pair">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="display mt-3 text-section">{title}</h1>
        </div>

        <div className="mt-8 max-w-[36em] space-y-5 text-[1.0625rem] leading-relaxed text-ink" data-ph-prose="">
          {topic ? (
            <article aria-label={title} className="space-y-2">
              <OutcomeBody id={id as keyof typeof HELP_TOPICS} />
            </article>
          ) : (
            <GuideBody id={id as HelpGuide} />
          )}

          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 pt-6" data-ph="pager">
            {prev ? (
              <Link rel="prev" to={helpPagePath(prev)} className={`${link} tap inline-flex min-h-11 items-center gap-2 sm:[@media(pointer:fine)]:min-h-0`}>
                {pagerArrow.prev}
                <span>{helpTitle(w, prev)}</span>
              </Link>
            ) : null}
            {next ? (
              <Link rel="next" to={helpPagePath(next)} className={`${link} tap ms-auto inline-flex min-h-11 items-center gap-2 sm:[@media(pointer:fine)]:min-h-0`}>
                <span>{helpTitle(w, next)}</span>
                {pagerArrow.next}
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </PageShell>
  );
}

export default function HelpTopic() {
  const { topic = "" } = useParams();
  const contactShown = sectionVisible(useSiteSettings(), "contact");
  return isHelpPage(topic, contactShown) ? <Page id={topic} /> : <NotFound />;
}
