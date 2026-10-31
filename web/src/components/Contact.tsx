import { useState } from "react";
import type { FormEvent } from "react";
import ObjectLabel from "@/components/gallery/ObjectLabel";
import { MAX_FIELDS, type LabelField } from "@/components/gallery/objectLabel";
import Rise, { riseOnLoad } from "@/components/motion/Rise";
import styles from "@/components/Contact.module.css";
import { links } from "@/data/links";
import { contact } from "@/data/site";
import { ContactSchema, sendContactMessage } from "@/services/contact";

/** The three things a message is made of. A closed union, so a field's error,
 *  its id and its name can never be a string the compiler has not seen. */
type FieldName = "name" | "email" | "message";

type FieldErrors = Partial<Record<FieldName, string>>;

/**
 * What the form is doing, as one value.
 *
 * A discriminated union rather than the `{ kind, message? }` record this used
 * to be: `message` was optional on every state, so "sent" could carry an error
 * string and "error" could carry none, and both of those are renderable.
 */
type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "failed"; message: string };

/*
 * The field line, built from data rather than typed out.
 *
 * The brief for this plate listed four fields — EMAIL, GITHUB, LINKEDIN and
 * the reply time — and the schema caps a label at three. Four is a datasheet,
 * which is what the project blocks were before they were cut back, so one had
 * to go and EMAIL is the one that earns its place least: the next four hundred
 * pixels of this page are an email form, and the address itself is printed
 * under it. A spec that states what the thing directly below it plainly is, is
 * not a spec.
 *
 * What is left is the two channels that are *not* on screen and the one fact a
 * reader cannot get by looking — how long an answer takes. `orderFields` sorts
 * by kind, so `where` lands before `when` and the line reads
 * GITHUB · LINKEDIN · USUALLY WITHIN A DAY whatever order they are written in
 * here.
 *
 * The profiles are sliced to `MAX_FIELDS - 1` rather than handed over whole.
 * Adding a third profile to `data/links.ts` would otherwise push the field
 * count to four, and the cap would silently drop the *last* kind in reading
 * order — the reply time — which is the one field on this plate that is a
 * promise. Reserving its slot here means a new profile costs a profile, which
 * is a decision somebody makes, instead of costing the promise, which is a
 * decision nobody makes.
 */
const PROFILE_SLOTS = MAX_FIELDS - 1;

const plateFields: LabelField[] = [
  ...links.slice(0, PROFILE_SLOTS).map((l): LabelField => ({ kind: "where", value: l.label })),
  { kind: "when", value: contact.replyWithin },
];

/*
 * The collection's last plate.
 *
 * The close is not a footer and not a call to action. It is the final object in
 * the gallery, labelled with the same three-part schema as every project and
 * every note — name, one line of fact, a field line — rendered through the same
 * `ObjectLabel` they are, at the same scale. That is the whole idea: the ask
 * reads as part of the collection rather than as the moment the catalog stops
 * and the sales page starts.
 *
 * Two cards used to be here, and the reasoning that put them there was sound
 * for the page that existed then: a form is an object with a boundary, and the
 * aside beside it was its alternative at the same altitude. Both arguments die
 * with the grammar. In a gallery the plate is the object, and a raised surface
 * around the ask makes it the one thing on the page that is a different kind of
 * thing from everything else. The aside's content did not survive either: the
 * profiles are specs on the plate and links in the footer, the location is in
 * the colophon, and "no third-party form provider sits in between" was a line
 * about the implementation of a form, which is not a fact about the work.
 *
 * What was cut from the *plan* for this section, and why it matters more than
 * what was cut from the page: the fields were to ink in as ruled lines and the
 * whole card was to fold once and fly off the top of the window on send. It
 * was the right instinct — the close should be the most satisfying moment —
 * aimed at the wrong page. The engineered peak is the pile, and a page with
 * three peaks has none, so the budget that would have bought the fold is spent
 * two sections up.
 *
 * One restraint from it survives and is worth more than the animation was:
 * THE CONFIRMATION LANDS BEFORE OR WITH ANY MOTION, NEVER AFTER IT. A card
 * that leaves and then says it worked looks like it ate the message. Here it is
 * satisfied structurally — see the note on the submit handler, and the one on
 * the receipt's own arrival further down — and the easiest way to keep it true
 * is the thing the grammar already demanded: nothing in this section exits. The last
 * screen of the page still has the plate, the form and the address on it after
 * everything has settled, which is the other half of the brief. A closing act
 * that fades to an empty stage is the page apologising for existing.
 */
export default function Contact() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    /* Hold the element itself: React nulls `currentTarget` once the handler
       returns, so reaching for it after the await threw — and the mail had
       already been sent, so a successful send reported itself as a failure. */
    const el = e.currentTarget;
    const form = new FormData(el);
    const draft = {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      message: String(form.get("message") ?? ""),
    };

    /*
     * Asked here with the service's own schema, so a bad field can be named.
     *
     * `sendContactMessage` parses what it is handed and throws one string with
     * every complaint joined by interpuncts, which is the right contract for a
     * service and useless as an error message: it cannot say *which* field, so
     * it cannot be attached to one, so the reader gets told something is wrong
     * with a form of three inputs and has to guess. Parsing here first gives
     * `fieldErrors`, which is what an `aria-describedby` needs.
     *
     * The service still validates. This parse is for the message, not for the
     * trust.
     */
    const parsed = ContactSchema.safeParse(draft);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      setFieldErrors({
        name: flat.name?.[0],
        email: flat.email?.[0],
        message: flat.message?.[0],
      });
      setStatus({
        kind: "failed",
        message: "Nothing was sent. There's a note under each field that needs a change.",
      });
      /*
       * Focus deliberately does not move to the first bad field.
       *
       * It is the obvious courtesy and it breaks the thing above it: moving
       * focus queues the new field's own announcement, which on several screen
       * readers cuts off the alert that has just been inserted — so the reader
       * is taken to a field and never told why. The alert is the announcement
       * and the per-field notes are what `aria-describedby` reads out when they
       * arrive there themselves.
       */
      return;
    }

    setFieldErrors({});
    setStatus({ kind: "sending" });

    try {
      await sendContactMessage(parsed.data);
      /*
       * The confirmation first, the reset second, and both in one update.
       *
       * React batches these into a single commit, so the receipt reaches the
       * live region in the same paint that empties the fields — the reader is
       * never shown a cleared form with nothing to explain it. The order is
       * written this way round anyway, because it is the order the rule is
       * stated in and the next person to add a step here should have to step
       * over it.
       */
      setStatus({ kind: "sent" });
      el.reset();
    } catch (err) {
      /*
       * Nothing is cleared on a failure. Not an oversight — the one thing a
       * reader cannot recover is the paragraph they just wrote, and a form
       * that empties itself when the send fails has thrown away the only copy
       * of the message it was asked to deliver.
       */
      const reason = err instanceof Error ? err.message : "something went wrong at my end";
      setStatus({
        kind: "failed",
        message: `Nothing was sent — ${reason}. Your message is still in the fields, and ${contact.email} works too.`,
      });
    }
  }

  /* Rendered under the field it belongs to, and referenced from it. The id is
     derived from the name so the two can never drift apart. */
  const errorId = (name: FieldName) => `contact-${name}-error`;

  return (
    <section id="contact" className="wrap section-y">
      {/*
       * `reveal`, which is beat 5 of the device ledger and the same family as
       * beat 0 — the two bookends of the page, and the only two places this
       * family appears. The pile between them is the engineered peak and gets
       * `pin`; the shelf gets `pan`; the specs get `count`. Nothing adjacent to
       * this beat is a reveal, which is the rule the ledger exists to keep.
       *
       * `Rise` and not a wipe, a sweep or a view timeline — and not three
       * hand-written delays either. Its three direct children here are the
       * plate, the form and the address, so they arrive 60ms apart in reading
       * order, once, and stay arrived; the note in Rise.module.css has why
       * "once" is the requirement and why a scroll timeline cannot express it.
       * The grain is right at this size too: a label is one object, so its
       * name, fact line and field line arrive together rather than as three
       * events inside one object.
       */}
      <Rise>
        {/*
         * `scale="object"` and not `plate`.
         *
         * The plate scale belongs to object zero — the title plate at the top
         * of the page, the thing the collection is named after, and the only
         * type on the site set above the section register. This is the last
         * object in the collection, not a second cover, so it is labelled at
         * exactly the size a project in the pile is.
         *
         * `nameAs="h2"` because the plate is still this section's heading in
         * the document. It replaced the section head rather than moving in
         * underneath one — which is what "typeset exactly like a label" costs,
         * and the whole reason the ask reads as part of the collection instead
         * of as the moment the catalog stops and the sales page starts.
         */}
        <ObjectLabel
          scale="object"
          nameAs="h2"
          name="Get in touch"
          fact="Mail reaches me faster than anything else"
          fields={plateFields}
        />

        {/*
         * `noValidate`, with `required` and `type="email"` left on the fields.
         *
         * The attributes stay: they are what tells assistive technology that a
         * field is required and what kind of keyboard a phone should offer. The
         * native *bubble* goes. It shows for a few seconds and then disappears,
         * it is announced inconsistently, it cannot be given a contrast ratio,
         * and it blocks the submit handler — so the legible, announced,
         * persistent errors this form draws itself would only ever be seen by
         * someone whose browser had already given up on them.
         */}
        <form
          className={styles.form}
          onSubmit={onSubmit}
          noValidate
          aria-label="Send a message"
          aria-describedby="contact-note"
        >
          <p id="contact-note" className={`${styles.note} text-fact`}>
            I&rsquo;m employed full-time and not looking for freelance work. I do read
            everything &mdash; if you&rsquo;re hiring, building something you think
            I&rsquo;d find interesting, or want to talk about anything on this page,
            write to me.
          </p>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="contact-name">
              Name
            </label>
            <input
              id="contact-name"
              name="name"
              type="text"
              required
              autoComplete="name"
              className={styles.control}
              aria-invalid={fieldErrors.name ? true : undefined}
              aria-describedby={fieldErrors.name ? errorId("name") : undefined}
            />
            {fieldErrors.name && (
              <p id={errorId("name")} className={styles.fieldError}>
                {fieldErrors.name}
              </p>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="contact-email">
              Email
            </label>
            <input
              id="contact-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className={styles.control}
              aria-invalid={fieldErrors.email ? true : undefined}
              aria-describedby={fieldErrors.email ? errorId("email") : undefined}
            />
            {fieldErrors.email && (
              <p id={errorId("email")} className={styles.fieldError}>
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="contact-message">
              Message
            </label>
            <textarea
              id="contact-message"
              name="message"
              rows={5}
              required
              className={`${styles.control} ${styles.message}`}
              aria-invalid={fieldErrors.message ? true : undefined}
              aria-describedby={fieldErrors.message ? errorId("message") : undefined}
            />
            {fieldErrors.message && (
              <p id={errorId("message")} className={styles.fieldError}>
                {fieldErrors.message}
              </p>
            )}
          </div>

          {/* `.btn .btn-solid`, which is what every primary action on this site
              already is, and nothing else. No magnet: a control that moves away
              from the pointer is a joke told once, and the ledger bans the
              family outright. */}
          <button
            type="submit"
            disabled={status.kind === "sending"}
            className={`btn btn-solid ${styles.send}`}
          >
            {status.kind === "sending" ? "Sending" : "Send message"}
            <span aria-hidden="true">&rarr;</span>
          </button>

          {/*
           * Two live regions, both present from the first paint and both
           * usually empty.
           *
           * They are separate because they are announced differently and a
           * region cannot change its mind: a receipt is polite and waits for a
           * gap, a failed send is an alert and does not. Swapping one element's
           * `role` between the two is the version of this that silently
           * announces nothing, because the region a screen reader is watching
           * is the one it saw when the page loaded.
           *
           * Neither is created at the moment its text is, for the same reason.
           * A live region that arrives together with its first content is a
           * region nobody has subscribed to yet, which loses the announcement
           * in exactly the case it was written for.
           */}
          <p role="status" aria-live="polite" aria-atomic="true" className={styles.status}>
            {status.kind === "sending" && "Sending"}
            {status.kind === "sent" && (
              /*
               * The confirmation rises into place, and the ordering rule is
               * satisfied by construction rather than by timing.
               *
               * `riseOnLoad` is the same measured reveal the section arrived
               * with, in its already-on-screen form: the span mounts carrying
               * both class names, so the animation starts on insertion instead
               * of waiting for an observer that has long since disconnected.
               * Borrowing it rather than writing 620ms and 14px again here is
               * the point — see the head of Contact.module.css.
               *
               * Why this cannot announce late: the text is committed to the DOM
               * in the same React update that sets the state, so the live region
               * has it, and announces it, before the first animation frame runs.
               * `opacity` and `transform` do not take an element out of the
               * accessibility tree, so what rises is a receipt that has already
               * been read out. And there is no exit motion anywhere in this
               * section for it to be late to, which is the other half of the
               * guarantee.
               */
              <span className={riseOnLoad}>
                <strong>Sent. I&rsquo;ll reply to the address you gave.</strong>
              </span>
            )}
          </p>
          <p role="alert" className={styles.failure}>
            {status.kind === "failed" ? status.message : null}
          </p>
        </form>

        <p className={styles.direct}>
          Or write to <a href={`mailto:${contact.email}`}>{contact.email}</a> from
          wherever you keep your mail.
        </p>
      </Rise>
    </section>
  );
}
