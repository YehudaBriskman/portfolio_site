import { FormEvent, useState } from "react";
import { links } from "@/data/links";
import { paragraphs } from "@/data/paragraphs";
import { infrastructure } from "@/data/infrastructure";
import { sendContactMessage } from "@/services/contact";

type Status = { kind: "idle" | "sending" | "sent" | "error"; message?: string };

export default function Contact() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setStatus({ kind: "sending" });
    try {
      await sendContactMessage({
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        message: String(form.get("message") ?? ""),
      });
      setStatus({ kind: "sent" });
      e.currentTarget.reset();
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Couldn't send that" });
    }
  }

  const field =
    "mt-2 w-full border-0 border-b border-edge bg-transparent px-0 py-3 text-bone placeholder:text-clay/45 focus:border-sodium focus:outline-none focus:ring-0 transition-colors";

  return (
    <section id="contact" className="relative mx-auto max-w-6xl px-6 py-28 sm:py-36">
      <p className="eyebrow">{paragraphs.contactUs.location} — {paragraphs.contactUs.current}</p>
      <h2 className="display-tight mt-5 text-section">{paragraphs.contactUs.secondTitle}</h2>

      <div className="mt-16 grid gap-16 lg:grid-cols-[1.1fr_1fr]">
        <form onSubmit={onSubmit} className="max-w-lg">
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

        <div>
          <a
            href={`mailto:${paragraphs.contactUs.email}`}
            className="display-tight block text-xl text-bone underline decoration-edge underline-offset-[6px] transition-colors hover:decoration-sodium sm:text-2xl"
          >
            {paragraphs.contactUs.email}
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
            This form posts to an Express service in the {""}
            <span className="text-clay">prod</span> namespace on the node described above, which
            relays over SMTP. No third-party form provider sits in between.
          </p>
        </div>
      </div>

      <footer className="mono mt-28 flex flex-wrap items-center justify-between gap-4 border-t border-edge pt-8 text-[0.6875rem] text-clay/60">
        <span>© {new Date().getFullYear()} Yehuda Briskman</span>
        <span>
          {infrastructure.regionLabel} — {infrastructure.shape}
        </span>
      </footer>
    </section>
  );
}
