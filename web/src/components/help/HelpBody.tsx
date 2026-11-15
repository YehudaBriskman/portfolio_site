import { Link } from "react-router-dom";
import { useContent } from "@/content/store";
import { useHelpWords } from "@/i18n/help";
import { HELP_TOPICS, type HelpTopic } from "@/lib/help/topics";
import type { HelpGuide } from "@/lib/help/pages";

/*
 * The body of one help page: the words are i18n/help.ts, untouched. These
 * are the same elements the long page held, one page at a time. Nothing here
 * says what happens to personal data or how fast a message is answered; the
 * privacy page and the accessibility statement own those claims.
 */

const list = "list-disc space-y-2 ps-6";
const link = "underline underline-offset-4";

export function GuideBody({ id }: { id: HelpGuide }) {
  const w = useHelpWords();
  const { contact } = useContent().site;
  switch (id) {
    case "language":
      return <>{w.languageBody.map((p) => <p key={p}>{p}</p>)}</>;
    case "look":
      return (
        <>
          <p>{w.lookBody}</p>
          <ul className={list}>
            {w.lookItems.map(([name, text]) => (
              <li key={name}>
                <strong>{name}</strong> {text}
              </li>
            ))}
          </ul>
          <p>
            <Link className={link} to="/accessibility">{w.lookMore}</Link>
          </p>
        </>
      );
    case "keyboard":
      return (
        <ul className={list}>
          {w.keyboardItems.map(([name, text]) => (
            <li key={name}>
              <strong>{name}</strong> {text}
            </li>
          ))}
        </ul>
      );
    case "sharing":
      return (
        <>
          <p>{w.sharingBody}</p>
          <ul className={list}>{w.sharingItems.map((item) => <li key={item}>{item}</li>)}</ul>
        </>
      );
    case "rss":
      return (
        <>
          <p>{w.rssBody}</p>
          <p>
            <a className={link} href="/feed.xml">{w.rssOpen}</a>
            {" · "}
            <span dir="ltr" className="mono text-sm">/feed.xml</span>
          </p>
        </>
      );
    case "contact-form":
      return (
        <>
          <p>
            {w.contactBefore}
            <Link className={link} to="/#contact">{w.contactLink}</Link>
            {w.contactAfter}
          </p>
          <ul className={list}>{w.contactItems.map((item) => <li key={item}>{item}</li>)}</ul>
          <p>
            {w.contactAddress}{" "}
            {"\u2066"}<a className={link} href={`mailto:${contact.email}`} dir="ltr">{contact.email}</a>{".\u2069"}
          </p>
        </>
      );
  }
}

export function OutcomeBody({ id }: { id: HelpTopic }) {
  const w = useHelpWords();
  const { contact } = useContent().site;
  const e = w.topics[id];
  return (
    <>
      <p><strong>{w.labelSee}</strong> {e.see}</p>
      <p><strong>{w.labelWhy}</strong> {e.why}</p>
      <p>
        <strong>{w.labelDo}</strong> {e.todo}
        {id === "unsubscribe-done" && (
          <>
            {" "}
            <Link className={link} to="/privacy">{w.privacyLink}</Link>
          </>
        )}
      </p>
      {HELP_TOPICS[id].kind === "problem" && (
        <p>
          {w.persistsBefore}
          {"\u2066"}<a className={link} href={`mailto:${contact.email}`} dir="ltr">{contact.email}</a>{".\u2069"}
        </p>
      )}
    </>
  );
}
