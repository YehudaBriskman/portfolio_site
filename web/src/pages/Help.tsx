import { useEffect, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import PageShell from "@/components/PageShell";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useContent } from "@/content/store";
import { sectionVisible } from "@/settings/schema";
import { useSiteSettings } from "@/settings/store";
import { useHelpWords } from "@/i18n/help";
import { HELP_GROUPS, HELP_TOPICS, helpTopics } from "@/lib/help/topics";
import { Keyboard, LifeBuoy, Languages, Mail, Palette, Rss, Share2 } from "lucide-react";
import GroupedSection from "@/components/phone/GroupedSection";
import ListRow from "@/components/phone/ListRow";
import type { Tone } from "@/components/phone/AvatarCircle";
import "@/components/phone/tokens.css";
import "@/components/phone/pages-info.css";

/*
 * The help page: how to use the site, one anchored section per topic.
 *
 * The words are in i18n/help.ts. Section ids are addresses (`/help#rss`), so
 * they never change once published. The contents list and the sections come
 * from one list, so a link cannot point at a section that is not there; the
 * contact section is left out, with its entry, when the form is hidden in the
 * site settings (#254).
 *
 * Nothing here says what happens to personal data or how fast a message is
 * answered. The privacy page and the accessibility statement own those
 * claims, and restating them here would leave two to keep true.
 *
 * A lazy page has no element yet when the browser looks for `#fragment` on a
 * direct load, so the effect below scrolls to it once the page is in.
 */

const list = "list-disc space-y-2 ps-6";
const link = "underline underline-offset-4";
const h2 = "display display-md scroll-mt-24 pt-6 text-object";

export default function Help() {
  const w = useHelpWords();
  useDocumentTitle(w.title);
  const { contact } = useContent().site;
  const contactShown = sectionVisible(useSiteSettings(), "contact");
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
  }, [hash]);

  /* The icon and tint are the phone's (a leading circle); above 640px the row is the old link. */
  const toc: { id: string; label: string; icon: ReactNode; tone: Tone }[] = [
    { id: "language", label: w.language, icon: <Languages data-ph-only="" aria-hidden="true" />, tone: "blue" },
    { id: "look", label: w.look, icon: <Palette data-ph-only="" aria-hidden="true" />, tone: "purple" },
    { id: "keyboard", label: w.keyboard, icon: <Keyboard data-ph-only="" aria-hidden="true" />, tone: "neutral" },
    { id: "sharing", label: w.sharing, icon: <Share2 data-ph-only="" aria-hidden="true" />, tone: "green" },
    { id: "rss", label: w.rss, icon: <Rss data-ph-only="" aria-hidden="true" />, tone: "yellow" },
    ...(contactShown ? [{ id: "contact-form", label: w.contact, icon: <Mail data-ph-only="" aria-hidden="true" />, tone: "blue" as Tone }] : []),
    { id: "problems", label: w.problems, icon: <LifeBuoy data-ph-only="" aria-hidden="true" />, tone: "red" },
  ];

  return (
    <PageShell>
      <section className="wrap section-y">
        <p className="eyebrow">{w.eyebrow}</p>
        <h1 className="display mt-3 text-section">{w.title}</h1>

        <div className="mt-8 max-w-[36em] space-y-5 text-[1.0625rem] leading-relaxed text-ink" data-ph-prose="">
          <p>{w.intro}</p>

          <nav aria-label={w.contents}>
            <p className="mono text-xs text-clay">{w.contents}</p>
            <GroupedSection>
              <ul className="mt-3 space-y-1">
                {toc.map((t) => (
                  <li key={t.id}>
                    <ListRow
                      href={`#${t.id}`}
                      icon={t.icon}
                      tone={t.tone}
                      className={`${link} -my-1 inline-flex min-h-11 items-center sm:min-h-0 sm:py-1 tap`}
                    >
                      <span>{t.label}</span>
                    </ListRow>
                  </li>
                ))}
              </ul>
            </GroupedSection>
          </nav>

          <h2 id="language" className={h2}>{w.language}</h2>
          {w.languageBody.map((p) => (
            <p key={p}>{p}</p>
          ))}

          <h2 id="look" className={h2}>{w.look}</h2>
          <p>{w.lookBody}</p>
          <ul className={list}>
            {w.lookItems.map(([name, text]) => (
              <li key={name}>
                <strong>{name}</strong> {text}
              </li>
            ))}
          </ul>
          <p>
            <Link className={link} to="/accessibility">
              {w.lookMore}
            </Link>
          </p>

          <h2 id="keyboard" className={h2}>{w.keyboard}</h2>
          <ul className={list}>
            {w.keyboardItems.map(([name, text]) => (
              <li key={name}>
                <strong>{name}</strong> {text}
              </li>
            ))}
          </ul>

          <h2 id="sharing" className={h2}>{w.sharing}</h2>
          <p>{w.sharingBody}</p>
          <ul className={list}>
            {w.sharingItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h2 id="rss" className={h2}>{w.rss}</h2>
          <p>{w.rssBody}</p>
          <p>
            <a className={link} href="/feed.xml">
              {w.rssOpen}
            </a>
            {" · "}
            <span dir="ltr" className="mono text-sm">/feed.xml</span>
          </p>

          {contactShown ? (
            <>
              <h2 id="contact-form" className={h2}>{w.contact}</h2>
              <p>
                {w.contactBefore}
                <Link className={link} to="/#contact">
                  {w.contactLink}
                </Link>
                {w.contactAfter}
              </p>
              <ul className={list}>
                {w.contactItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p>
                {w.contactAddress}{" "}
                <a className={link} href={`mailto:${contact.email}`} dir="ltr">
                  {contact.email}
                </a>
                .
              </p>
            </>
          ) : null}

          <h2 id="problems" className={h2}>{w.problems}</h2>
          <p>{w.problemsIntro}</p>
          {HELP_GROUPS.map((g) => (
            <section key={g} aria-labelledby={`problems-${g}`} className="space-y-5">
              <h3 id={`problems-${g}`} className="display scroll-mt-24 pt-4 text-lg">{w.groupTitles[g]}</h3>
              {helpTopics
                .filter((t) => HELP_TOPICS[t].group === g)
                .map((t) => {
                  const e = w.topics[t];
                  return (
                    <article key={t} aria-labelledby={t} className="space-y-2">
                      <h4 id={t} className="scroll-mt-24 font-semibold">{e.title}</h4>
                      <p><strong>{w.labelSee}</strong> {e.see}</p>
                      <p><strong>{w.labelWhy}</strong> {e.why}</p>
                      <p>
                        <strong>{w.labelDo}</strong> {e.todo}
                        {t === "unsubscribe-done" && (
                          <>
                            {" "}
                            <Link className={link} to="/privacy">
                              {w.privacyLink}
                            </Link>
                          </>
                        )}
                      </p>
                      {HELP_TOPICS[t].kind === "problem" && (
                        <p>
                          {w.persistsBefore}
                          <a className={link} href={`mailto:${contact.email}`} dir="ltr">
                            {contact.email}
                          </a>
                          .
                        </p>
                      )}
                    </article>
                  );
                })}
            </section>
          ))}

          <p className="pt-6">
            <Link className={link} to="/">
              {w.back}
            </Link>
          </p>
        </div>
      </section>
    </PageShell>
  );
}
