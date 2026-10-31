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
   * A field with a shape, not a line under some words.
   *
   * These were bottom-rules on a transparent ground: no left edge, no right
   * edge, no corner, and nothing saying where the box you are typing into
   * begins. A field is now a real recessed well — white at 70% over whatever
   * wash the card is wearing, a 22px corner on a 48px-tall control, and a
   * border you can see.
   *
   * The border is --ink-soft and not --rule-firm, for the reason `.btn-quiet`
   * gives in index.css: a rule is a hairline between two pieces of content
   * and measures 2.50-2.56:1 on this fill, under the 3:1 that the boundary of
   * a control someone has to find is held to. --ink-soft measures 7.41-7.59:1
   * on it, across all five washes.
   *
   * Focus is a real 2px outline rather than a change of border colour. The
   * old rule killed the outline outright and leaned on the border going
   * darker, which is a 1px signal a keyboard user has to hunt for; the
   * outline sits outside the field and cannot be missed.
   *
   * The typed text is --ink at 17.67-18.10:1 on the fill, and the placeholder
   * --ink-soft at 7.41-7.59:1 rather than an alpha of it, because a
   * placeholder is read and nothing anyone reads gets to sit below AA.
   */
  const field =
    "mt-[var(--card-step-tight)] w-full rounded-[var(--r-md)] border border-clay bg-white/70 px-4 py-3 text-ink placeholder:text-clay transition-colors focus:border-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

  return (
    <section id="contact" className="wrap section-y isolate relative">
      {/* The availability half of this line has moved into the card below,
          where it is a fact with a label on it rather than nine more words of
          12px capitals above a 144px headline. The location stays: an
          eyebrow's job is to say where in the world the section is speaking
          from, and that is the half that does it. */}
      <p className="eyebrow">{contact.location}</p>
      {/* `.display`, like every other section head. */}
      <h2 className="display mt-3 text-section">Get in touch</h2>

      {/* 2xl rather than xl. Held to 36rem this paragraph ended a third of
          the way across a 67rem column with the heading running the full
          width above it, which is most of the "a lot of empty space to the
          right" this section was called out for. 42rem is still a reading
          measure — about 78 characters at this size. */}
      <p className="mt-12 max-w-2xl text-lg leading-relaxed text-clay">
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
       *
       * Which is also why their washes are written here rather than coming
       * from `cardCycle`: with no wipe there is no stroke for a resting
       * colour to agree with. The pair takes the next two steps of the cycle
       * after the three notes above it — green, then purple — so the page
       * finishes the run instead of replaying it. Offsetting a whole group is
       * the same move the stacking deck makes, for the same reason.
       */}
      {/*
       * `items-stretch`, which is the default, rather than the `items-start`
       * that was here.
       *
       * Aligned to the top, the short card stopped 250px above the tall one
       * and left a quarter of the section as blank paper in the bottom right
       * corner — the largest hole on the home page. Two alternatives sitting
       * at the same altitude was the whole argument for making them two
       * cards; two alternatives of visibly different size is a main one and
       * an afterthought.
       */}
      <div className="mt-12 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <PaperCard className="min-w-0 [--card-wash:var(--wash-green)]">
          <form onSubmit={onSubmit}>
            <label className="block">
              <span className={cardType.meta}>Name</span>
              <input name="name" required autoComplete="name" className={field} placeholder="Your name" />
            </label>
            <label className="mt-[var(--card-step)] block">
              <span className={cardType.meta}>Email</span>
              <input name="email" type="email" required autoComplete="email" className={field} placeholder="you@company.com" />
            </label>
            <label className="mt-[var(--card-step)] block">
              <span className={cardType.meta}>Message</span>
              <textarea name="message" required rows={4} className={`${field} resize-none`} placeholder="What are you building?" />
            </label>

            {/* `.btn .btn-solid`, which is what the rest of the site's primary
                actions already are. */}
            <button
              type="submit"
              disabled={status.kind === "sending"}
              className="btn btn-solid mt-[calc(var(--card-step)*2)] disabled:cursor-not-allowed disabled:opacity-45"
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
            <p aria-live="polite" className="mono mt-[var(--card-step)] min-h-[1.25rem] text-xs text-clay">
              {status.kind === "sent" && <span className="text-ink">Sent. I'll reply to the address you gave.</span>}
              {status.kind === "error" && <span>{status.message}</span>}
            </p>
          </form>
        </PaperCard>

        {/*
         * Three blocks spread over the height the form gives this card: how
         * to write to me, where I am, and what happens to a message.
         *
         * `justify-between` over three groups rather than over seven loose
         * children. Spread across every child, the free space fell between
         * the address and the hairline under it and pushed the two apart —
         * which is the one gap in here that is meant to be small, because the
         * rule belongs to the address above it.
         */}
        <PaperCard
          as="aside"
          className="flex min-w-0 flex-col justify-between gap-[calc(var(--card-step)*2)] [--card-wash:var(--wash-purple)]"
          aria-label="Other ways to reach me"
        >
          <div>
            <a
            href={`mailto:${contact.email}`}
              className={`${cardType.title} -my-2 flex min-h-11 items-center break-all py-2 underline decoration-ink/30 underline-offset-[6px] transition-colors hover:decoration-ink`}
            >
              {contact.email}
            </a>

            <InkRule className="mt-[var(--card-step)]" />

            <ul className="mt-[var(--card-step)] grid grid-cols-2 gap-x-6 gap-y-3">
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
          </div>

          {/*
           * Two facts with labels on them, which is what finally gives this
           * card something to be.
           *
           * It held an address, two profile links and one sentence — about
           * 280px of content — beside a form that stands 650px tall, so
           * either the pair sat at different heights with a quarter of the
           * section blank next to the short one, or the short one stretched
           * and carried 370px of empty card. Neither is a layout problem;
           * both are the same content problem. The availability line came out
           * of the eyebrow above, where it was being skimmed past, and the
           * location is repeated here because this is the card someone reads
           * when they are deciding whether to write.
           */}
          <dl className="grid gap-[var(--card-step)] sm:grid-cols-2 lg:grid-cols-1">
            <div>
              <dt className={cardType.meta}>Based in</dt>
              <dd className={`${cardType.body} mt-[var(--card-step-tight)] text-sm`}>
                {contact.location}
              </dd>
            </div>
            <div>
              <dt className={cardType.meta}>Right now</dt>
              <dd className={`${cardType.body} mt-[var(--card-step-tight)] text-sm`}>
                {contact.availability}
              </dd>
            </div>
          </dl>

          <p className={`${cardType.body} border-t border-ridge pt-[var(--card-step)] text-sm`}>
            Messages reach me directly. No third-party form provider sits in between.
          </p>
        </PaperCard>
      </div>
    </section>
  );
}
