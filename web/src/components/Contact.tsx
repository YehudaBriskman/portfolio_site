import { FormEvent, useState } from "react";
import { links } from "@/data/links";
import { contact } from "@/data/site";
import { sendContactMessage } from "@/services/contact";

type Status = { kind: "idle" | "sending" | "sent" | "error"; message?: string };

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

  const field =
    "mt-3 w-full border-0 border-b border-edge bg-transparent px-0 py-3 text-bone placeholder:text-clay/60 focus:border-bone focus:outline-none focus:ring-0 transition-colors";

  return (
    <section id="contact" className="wrap section-y isolate relative">
      <p className="eyebrow">{contact.location} &middot; {contact.availability}</p>
      {/* `.display`, like every other section head. This was the one that used
          `.display-tight` at the section size, so it was the only heading on
          the site set in a narrower face at the same scale as the rest. */}
      <h2 className="display mt-3 text-section">Get in touch</h2>

      <div className="mt-12 grid gap-12 lg:grid-cols-[1.1fr_1fr]">
        <div className="min-w-0 max-w-lg">
          <p className="mb-12 text-sm leading-relaxed text-bone/70">
            I&rsquo;m employed full-time and not looking for freelance work. I do read everything.
            If you&rsquo;re hiring, building something you think I&rsquo;d find interesting, or want
            to talk about anything on this page, write to me.
          </p>
        <form onSubmit={onSubmit}>
          <label className="block">
            <span className="mono text-xs uppercase tracking-[0.22em] text-clay">Name</span>
            <input name="name" required autoComplete="name" className={field} placeholder="Your name" />
          </label>
          <label className="mt-6 block">
            <span className="mono text-xs uppercase tracking-[0.22em] text-clay">Email</span>
            <input name="email" type="email" required autoComplete="email" className={field} placeholder="you@company.com" />
          </label>
          <label className="mt-6 block">
            <span className="mono text-xs uppercase tracking-[0.22em] text-clay">Message</span>
            <textarea name="message" required rows={4} className={`${field} resize-none`} placeholder="What are you building?" />
          </label>

          {/* `.btn .btn-solid`, which is what the rest of the site's primary
              actions already are. This was a hand-rolled pill in the accent
              colour that happened to be the same shape and a different size,
              so the one button a visitor is most likely to press was the one
              button not built out of the design system. */}
          <button
            type="submit"
            disabled={status.kind === "sending"}
            className="btn btn-solid mt-12 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {status.kind === "sending" ? "Sending" : "Send message"}
            <span aria-hidden="true">→</span>
          </button>

          {/* Confirmation at full strength and the failure one step down. The
              success line was in the accent, which read as a warning rather
              than as a receipt; the words carry the meaning here either way,
              and the live region is what actually announces it. */}
          <p aria-live="polite" className="mono mt-6 min-h-[1.25rem] text-xs">
            {status.kind === "sent" && <span className="text-bone">Sent. I'll reply to the address you gave.</span>}
            {status.kind === "error" && <span className="text-clay">{status.message}</span>}
          </p>
        </form>
        </div>

        <div className="min-w-0">
          <a
            href={`mailto:${contact.email}`}
            className="display-tight -my-2 flex min-h-11 items-center py-2 text-xl text-bone underline decoration-bone/30 underline-offset-[6px] transition-colors hover:decoration-bone sm:text-2xl"
          >
            {contact.email}
          </a>

          <ul className="mt-12 grid grid-cols-2 gap-x-6 gap-y-3">
            {links
              .filter((l) => l.name !== "gmail")
              .map((l) => (
                <li key={l.name}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mono -my-3 inline-flex min-h-11 items-center py-3 text-xs uppercase tracking-[0.18em] text-clay transition-colors hover:text-bone"
                  >
                    {l.name}
                  </a>
                </li>
              ))}
          </ul>

          <p className="mono mt-section-sm border-t border-edge pt-6 text-xs leading-relaxed text-clay">
            Messages reach me directly. No third-party form provider sits in between.
          </p>
        </div>
      </div>
    </section>
  );
}
