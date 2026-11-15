import { useEffect } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import PageShell from "@/components/PageShell";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { sectionVisible } from "@/settings/schema";
import { useSiteSettings } from "@/settings/store";
import { useHelpWords } from "@/i18n/help";
import { HELP_GROUPS, HELP_TOPICS, helpTopics, type HelpTopic } from "@/lib/help/topics";
import { HELP_GUIDES, helpPageIds, helpPagePath, legacyHelpTarget, type HelpPage } from "@/lib/help/pages";
import { helpRowLook, helpTitle } from "@/components/help/helpRows";
import { useHelpMotion } from "@/components/help/useHelpMotion";
import GroupedSection from "@/components/phone/GroupedSection";
import ListRow from "@/components/phone/ListRow";
import "@/components/phone/tokens.css";
import "@/components/phone/pages-info.css";
import "@/components/help/helpMotion.css";

/*
 * The help index (#803): one row per page, the guides first and then the
 * outcome topics under their three groups. Each row is a page of its own at
 * `/help/<id>` (pages/HelpTopic.tsx); this page holds no topic's text.
 *
 * The ids are addresses and never change. An old `/help#<id>` anchor lands
 * here and is sent on to `/help/<id>` before anything is drawn. `#problems`
 * and `#problems-<group>` are headings of this page, so they stay.
 *
 * The words are in i18n/help.ts, unchanged. The contact form's guide is left
 * out, with its row, when the form is hidden in the site settings (#254).
 */

const link = "underline underline-offset-4";
const h2 = "display display-md scroll-mt-24 pt-6 text-object";

function Rows({ ids, titleOf }: { ids: readonly HelpPage[]; titleOf: (id: HelpPage) => string }) {
  return (
    <GroupedSection>
      <ul className="mt-3 space-y-1">
        {ids.map((id) => {
          const { icon, tone } = helpRowLook(id);
          return (
            <li key={id}>
              <ListRow to={helpPagePath(id)} icon={icon} tone={tone} className={`${link} -my-1 inline-flex min-h-11 items-center sm:[@media(pointer:fine)]:min-h-0 sm:py-1 tap`}>
                <span>{titleOf(id)}</span>
              </ListRow>
            </li>
          );
        })}
      </ul>
    </GroupedSection>
  );
}

export default function Help() {
  const w = useHelpWords();
  useDocumentTitle(w.title);
  const contactShown = sectionVisible(useSiteSettings(), "contact");
  const { hash } = useLocation();
  const moved = legacyHelpTarget(hash, contactShown);
  const motion = useHelpMotion(null, helpPageIds(contactShown));

  useEffect(() => {
    if (!hash || moved) return;
    document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView?.();
  }, [hash, moved]);

  if (moved) return <Navigate to={moved} replace />;

  const titleOf = (id: HelpPage) => helpTitle(w, id);
  const guides = HELP_GUIDES.filter((g) => contactShown || g !== "contact-form");

  return (
    <PageShell>
      <section className="wrap section-y page-first" {...motion}>
        <div className="title-pair">
          <p className="eyebrow">{w.eyebrow}</p>
          <h1 className="display mt-3 text-section">{w.title}</h1>
        </div>

        <div className="mt-8 max-w-[36em] space-y-5 text-[1.0625rem] leading-relaxed text-ink" data-ph-prose="">
          <p>{w.intro}</p>

          <nav aria-label={w.contents}>
            <p className="mono text-xs text-clay">{w.contents}</p>
            <Rows ids={guides} titleOf={titleOf} />
          </nav>

          <h2 id="problems" className={h2}>{w.problems}</h2>
          <p>{w.problemsIntro}</p>
          {HELP_GROUPS.map((g) => (
            <section key={g} aria-labelledby={`problems-${g}`} className="space-y-3">
              <h3 id={`problems-${g}`} className="display scroll-mt-24 pt-4 text-lg">{w.groupTitles[g]}</h3>
              <Rows ids={helpTopics.filter((t: HelpTopic) => HELP_TOPICS[t].group === g)} titleOf={titleOf} />
            </section>
          ))}

          <p className="pt-6">
            <Link className={link} to="/">{w.back}</Link>
          </p>
        </div>
      </section>
    </PageShell>
  );
}
