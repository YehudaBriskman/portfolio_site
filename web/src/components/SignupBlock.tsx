import { useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import styles from "@/components/SignupBlock.module.css";
import { useLang } from "@/components/dashboard/i18n";
import { useSubscribeWords } from "@/i18n/subscribe";
import { SubscribeError, looksLikeEmail, subscribe, type Topics } from "@/services/subscribe";

/*
 * The signup block: home page end, end of a note, and /follow.
 *
 * What it will not do. It does not say whether an address is already known
 * (the server answers 202 either way, and so does this), it does not pre-tick
 * a consent box (the topics are a choice of content, and the consent is the
 * sentence above the button), it does not load a script or a font, and it
 * does not move the page: the status line is always rendered and always
 * reserves its height, so a message arriving shifts nothing below it.
 *
 * The honeypot field is `website`, named as the server expects. It is a real
 * input out of sight, not `display: none`, which some bots skip.
 */

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "error"; text: string };

type Props = {
  /** The heading level, so the block sits correctly in each page's outline. */
  as?: "h1" | "h2";
  className?: string;
};

export default function SignupBlock({ as: Heading = "h2", className = "" }: Props) {
  const w = useSubscribeWords();
  const lang = useLang();
  const uid = useId();
  const id = (s: string) => `${uid}-${s}`;
  const emailRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [topics, setTopics] = useState<Topics>({ blog: true, releases: false });
  const [emailError, setEmailError] = useState<string | null>(null);
  const [topicError, setTopicError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const sending = status.kind === "sending";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (sending) return;
    const badEmail = looksLikeEmail(email) ? null : w.errEmail;
    const badTopics = topics.blog || topics.releases ? null : w.errTopics;
    setEmailError(badEmail);
    setTopicError(badTopics);
    if (badEmail || badTopics) {
      setStatus({ kind: "idle" });
      if (badEmail) emailRef.current?.focus();
      return;
    }
    setStatus({ kind: "sending" });
    try {
      await subscribe({ email, name, lang, topics, website });
      setEmail("");
      setName("");
      setStatus({ kind: "sent" });
    } catch (err) {
      const kind = err instanceof SubscribeError ? err.kind : "server";
      const text = kind === "rate" ? w.errRate : kind === "network" ? w.errNetwork : w.errServer;
      setStatus({ kind: "error", text });
    }
  }

  const message = status.kind === "sent" ? w.sent : status.kind === "error" ? status.text : status.kind === "sending" ? w.sending : "";

  return (
    <section className={`${styles.block} ${className}`} aria-labelledby={id("h")} data-signup>
      <Heading id={id("h")} className={styles.heading}>
        {w.heading}
      </Heading>
      <p className={styles.lede}>{w.lede}</p>

      <form className={styles.form} onSubmit={onSubmit} noValidate aria-label={w.formLabel}>
        <div>
          <label className={styles.label} htmlFor={id("email")}>
            {w.email}
          </label>
          <input
            ref={emailRef}
            id={id("email")}
            className={styles.control}
            type="email"
            name="email"
            inputMode="email"
            autoComplete="email"
            dir="ltr"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? id("email-err") : undefined}
          />
          {emailError && (
            <p id={id("email-err")} className={styles.fieldError}>
              {emailError}
            </p>
          )}
        </div>

        <div>
          <label className={styles.label} htmlFor={id("name")}>
            {w.name}
          </label>
          <input
            id={id("name")}
            className={styles.control}
            type="text"
            name="name"
            autoComplete="name"
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <fieldset className={styles.fieldset} aria-describedby={topicError ? id("topics-err") : undefined}>
          <legend className={styles.legend}>{w.topics}</legend>
          <div className={styles.checks}>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={topics.blog}
                onChange={(e) => setTopics({ ...topics, blog: e.target.checked })}
              />
              {w.topicBlog}
            </label>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={topics.releases}
                onChange={(e) => setTopics({ ...topics, releases: e.target.checked })}
              />
              {w.topicReleases}
            </label>
          </div>
          {topicError && (
            <p id={id("topics-err")} className={styles.fieldError}>
              {topicError}
            </p>
          )}
        </fieldset>

        <div className={styles.trap} aria-hidden="true">
          <label>
            {w.trapLabel}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>
        </div>

        <p className={styles.consent}>
          {w.consentBefore}{" "}
          <Link to="/accessibility#privacy">{w.consentLink}</Link>
          {"."}
        </p>

        <button type="submit" className={`btn btn-solid ${styles.submit}`} disabled={sending} aria-disabled={sending || undefined}>
          {sending ? w.sending : w.submit}
        </button>

        {/* Always rendered, so a screen reader's live region exists before the
            first message and the page below never moves. */}
        <p role="status" aria-live="polite" aria-atomic="true" className={styles.status} data-kind={status.kind}>
          {message}
        </p>
      </form>
    </section>
  );
}
