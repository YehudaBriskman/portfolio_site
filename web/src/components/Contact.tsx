import { FormEvent, useState } from "react";
import PaperCard from "@/components/cards/PaperCard";
import { cardType } from "@/components/cards/cardType";
import InkRule from "@/components/motion/InkRule";
import { links } from "@/data/links";
import { contact } from "@/data/site";
import { sendContactMessage } from "@/services/contact";

type Status = { kind: "idle" | "sending" | "sent" | "error"; message?: string };

/*
 * Two cards, and neither of them is decoration.
 *
 * A form is the clearest case on the page for a raised surface: it is a
 * single object with a boundary, you put things into it, and the boundary is
 * what tells a reader where "filling this in" starts and stops. Underlined
 * fields floating on the paper had no such edge, which is why the submit
 * button read as belonging to the paragraph above it rather than to the
 * fields above it.
 *
 * The second card is the way round the form — the address, the profiles, and
 * the sentence about where a message actually goes. It is a card because it
 * is the alternative to the first one, and two alternatives sitting at the
 * same altitude is how a reader sees that they are alternatives.
 *
 * The heading and the invitation above them stay on the paper. A section head
 * in a box has stopped being a section head.
 */
export default function Contact() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Hold the element itself: React nulls currentTarget once the handler
    // returns, so reaching for it after the await threw — and the mail had
    // already been sent, so a successful send reported itself as a failure.
    const el = e.currentTarget;
    const form = new FormData(el);
    setStatus({ kind: "sending" });
    try {
      await sendContactMessage({
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        message: String(form.get("message") ?? ""),
      });
      setStatus({ kind: "sent" });
      el.reset();
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Couldn't send that" });
    }
  }

  /*
   * Fields on a card, not on the ground.
   *
   * `border-edge` is --rule, a hairline tuned for the paper; on the card's
   * lighter surface it measures 1.51:1 and all but disappears, so the resting
   * underline is --rule-firm (2.41:1) and focus takes it to solid ink. The
   * typed text is --ink at 17.00:1 on the card. The placeholder is --ink-soft
   * at 7.13:1 rather than the old --clay/60, because a placeholder is read
   * and nothing anyone reads gets to sit below AA.
   */
  const field =
    "mt-3 w-full border-0 border-b border-ridge bg-transparent px-0 py-3 text-ink placeholder:text-clay focus:border-ink focus:outline-none focus:ring-0 transition-colors";

  return (
    <section id="contact" className="wrap section-y isolate relative">
      <p className="eyebrow">{contact.location} &middot; {contact.availability}</p>
      {/* `.display`, like every other section head. */}
      <h2 className="display mt-3 text-section">Get in touch</h2>

      <p className="mt-12 max-w-xl text-lg leading-relaxed text-clay">
        I&rsquo;m employed full-time and not looking for freelance work. I do read everything.
        If you&rsquo;re hiring, building something you think I&rsquo;d find interesting, or want
        to talk about anything on this page, write to me.
      </p>

      {/*
       * Deliberately no ink wipe on these two cards.
       *
       * A clip path travelling across a form is motion the reader is about to
       * interrupt — they arrive here to type, not to watch — and a clip on a
       * focused field would crop its focus ring while it moved. The cards
       * further up the page earn the stroke because they are read; these two
       * are used.
       */}
      <div className="mt-12 grid items-start gap-6 lg:grid-cols-[1.1fr_1fr]">
        <PaperCard className="min-w-0">
          <form onSubmit={onSubmit}>
            <label className="block">
              <span className={cardType.meta}>Name</span>
              <input name="name" required autoComplete="name" className={field} placeholder="Your name" />
            </label>
            <label className="mt-6 block">
              <span className={cardType.meta}>Email</span>
              <input name="email" type="email" required autoComplete="email" className={field} placeholder="you@company.com" />
            </label>
            <label className="mt-6 block">
              <span className={cardType.meta}>Message</span>
              <textarea name="message" required rows={4} className={`${field} resize-none`} placeholder="What are you building?" />
            </label>

            {/* `.btn .btn-solid`, which is what the rest of the site's primary
                actions already are. */}
            <button
              type="submit"
              disabled={status.kind === "sending"}
              className="btn btn-solid mt-12 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {status.kind === "sending" ? "Sending" : "Send message"}
              <span aria-hidden="true">→</span>
            </button>

            {/* Confirmation at full strength and the failure one step down.
                The words carry the meaning either way; the live region is
                what actually announces it. */}
            {/* Not `cardType.meta`: that role is uppercase, and a sentence
                set in capitals is a sign, not a receipt. --ink-soft, 7.13:1
                on the card. */}
            <p aria-live="polite" className="mono mt-6 min-h-[1.25rem] text-xs text-clay">
              {status.kind === "sent" && <span className="text-ink">Sent. I'll reply to the address you gave.</span>}
              {status.kind === "error" && <span>{status.message}</span>}
            </p>
          </form>
        </PaperCard>

        <PaperCard as="aside" className="min-w-0" aria-label="Other ways to reach me">
          <a
            href={`mailto:${contact.email}`}
            className={`${cardType.title} -my-2 flex min-h-11 items-center break-all py-2 underline decoration-ink/30 underline-offset-[6px] transition-colors hover:decoration-ink`}
          >
            {contact.email}
          </a>

          <InkRule className="mt-6" />

          <ul className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3">
            {links
              .filter((l) => l.name !== "gmail")
              .map((l) => (
                <li key={l.name}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={`${cardType.meta} -my-3 inline-flex min-h-11 items-center py-3 transition-colors hover:text-ink`}
                  >
                    {l.name}
                  </a>
                </li>
              ))}
          </ul>

          <p className={`${cardType.body} mt-12 border-t border-ridge pt-6 text-sm`}>
            Messages reach me directly. No third-party form provider sits in between.
          </p>
        </PaperCard>
      </div>
    </section>
  );
}
