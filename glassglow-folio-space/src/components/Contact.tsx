import { FormEvent, useState } from "react";
import Scenery from "@/components/scene/Scenery";
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
    "mt-2 w-full border-0 border-b border-edge bg-transparent px-0 py-3 text-bone placeholder:text-clay/45 focus:border-sodium focus:outline-none focus:ring-0 transition-colors";

  return (
    <section id="contact" className="isolate relative mx-auto max-w-6xl px-6 py-28 sm:py-36">
      <Scenery variant="ripples" />
      <p className="eyebrow">{contact.location} — {contact.availability}</p>
      <h2 className="display-tight mt-5 text-section">Get in touch</h2>

      <div className="mt-16 grid gap-16 lg:grid-cols-[1.1fr_1fr]">
        <div className="max-w-lg">
          <p className="mb-10 text-sm leading-relaxed text-bone/70">
            I&rsquo;m employed full-time and not looking for freelance work. I do read everything.
            If you&rsquo;re hiring, building something you think I&rsquo;d find interesting, or want
            to talk about anything on this page, write to me.
          </p>
        <form onSubmit={onSubmit}>
          <label className="block">
            <span className="mono text-[0.6875rem] uppercase tracking-[0.22em] text-clay">Name</span>
            <input name="name" required autoComplete="name" className={field} placeholder="Your name" />
          </label>
          <label className="mt-9 block">
            <span className="mono text-[0.6875rem] uppercase tracking-[0.22em] text-clay">Email</span>
            <input name="email" type="email" required autoComplete="email" className={field} placeholder="you@company.com" />
          </label>
          <label className="mt-9 block">
            <span className="mono text-[0.6875rem] uppercase tracking-[0.22em] text-clay">Message</span>
            <textarea name="message" required rows={4} className={`${field} resize-none`} placeholder="What are you building?" />
          </label>

          <button
            type="submit"
            disabled={status.kind === "sending"}
            className="mono mt-11 inline-flex items-center gap-3 border border-sodium px-7 py-3.5 text-xs uppercase tracking-[0.22em] text-sodium transition-colors hover:bg-sodium hover:text-ink disabled:cursor-not-allowed disabled:opacity-45"
          >
            {status.kind === "sending" ? "Sending" : "Send message"}
            <span aria-hidden="true">→</span>
          </button>

          <p aria-live="polite" className="mono mt-5 min-h-[1.25rem] text-xs">
            {status.kind === "sent" && <span className="text-sodium">Sent. I'll reply to the address you gave.</span>}
            {status.kind === "error" && <span className="text-clay">{status.message}</span>}
          </p>
        </form>
        </div>

        <div>
          <a
            href={`mailto:${contact.email}`}
            className="display-tight block text-xl text-bone underline decoration-edge underline-offset-[6px] transition-colors hover:decoration-sodium sm:text-2xl"
          >
            {contact.email}
          </a>

          <ul className="mt-10 grid grid-cols-2 gap-x-8 gap-y-3">
            {links
              .filter((l) => l.name !== "gmail")
              .map((l) => (
                <li key={l.name}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mono text-xs uppercase tracking-[0.18em] text-clay transition-colors hover:text-sodium"
                  >
                    {l.name}
                  </a>
                </li>
              ))}
          </ul>

          <p className="mono mt-16 border-t border-edge pt-8 text-[0.6875rem] leading-relaxed text-clay/70">
            Messages reach me directly. No third-party form provider sits in between.
          </p>
        </div>
      </div>

      <footer className="mono mt-28 flex flex-wrap items-center justify-between gap-4 border-t border-edge pt-8 text-[0.6875rem] text-clay/60">
        <span>© {new Date().getFullYear()} Yehuda Briskman</span>
        <span className="flex items-center gap-5">
          <span>Tel Aviv, Israel</span>
          {/* Deliberately quiet rather than hidden. Security here is the GitHub
              wall in front of the admin host, not the obscurity of the link —
              pretending otherwise would be the weaker of the two. */}
          <a
            href="https://admin.yehudabriskman.com/admin"
            className="text-clay/20 transition-colors hover:text-sodium focus-visible:text-sodium"
            aria-label="Admin"
          >
            admin
          </a>
        </span>
      </footer>
    </section>
  );
}
