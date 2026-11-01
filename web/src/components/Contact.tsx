import { useState } from "react";
import type { FormEvent } from "react";
import ObjectLabel from "@/components/gallery/ObjectLabel";
import { MAX_FIELDS, type LabelField } from "@/components/gallery/objectLabel";
import Arrived from "@/components/motion/Arrived";
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
 * What was cut from the *plan* for this section, and what was kept: the whole
 * card was to fold once and fly off the top of the window on send. That is
 * gone and stays gone — the engineered peak is the pile, and a page with three
 * peaks has none, so the budget that would have bought the fold is spent two
 * sections up. The other half of that plan, the fields inking in as ruled
 * lines, is built: it costs no frame budget, nothing about it exits, and it is
 * the one place on this page where an animation can carry information rather
 * than emphasis. Which of the two survived is the difference between a gesture
 * that says *look at this* and one that says *this is what this field is for*.
 *
 * Three fields, three treatments, and the difference is the structure
 * -------------------------------------------------------------------
 * A name, an address and a message are three different kinds of input, and a
 * per-field effect is only worth having if it says which is which. Three
 * easings is not that. So each field differs in the two things a reader can
 * actually read — the measure of the rule and the way the ink arrives on it —
 * and the full sentence for each sits beside it below.
 *
 * One restraint from the cut plan survives and is worth more than the
 * animation was:
 * THE CONFIRMATION LANDS BEFORE OR WITH ANY MOTION, NEVER AFTER IT. A card
 * that leaves and then says it worked looks like it ate the message. Here it is
 * satisfied structurally — see the note on the submit handler, and the one on
 * the receipt's own arrival further down — and the easiest way to keep it true
 * is the thing the grammar already demanded: nothing in this section exits. The last
 * screen of the page still has the plate, the form and the address on it after
 * everything has settled, which is the other half of the brief. A closing act
 * that fades to an empty stage is the page apologising for existing.
 *
 * And it has to *resolve*. The last feeling is the one the reader carries off
 * the page, so the close cannot trail away into a footer — whatever the peak
 * did gets overwritten by whatever the ending does. Two marks do that work,
 * both additive: on a successful send the three field rules, which arrive at
 * three different lengths, draw out to one flush length under the receipt — the
 * three answers leaving as one message. And the section signs off with a rule
 * across the column that ends in a printer's end-mark, drawn as the reader
 * reaches it, so the page stops on a full stop instead of running out.
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
        {/*
         * The gate for the field rules, and why the form needs one at all.
         *
         * The rules are drawn on a clock rather than on a view timeline,
         * because a view timeline runs backwards when the reader scrolls up and
         * these particular rules are the controls' own boundaries — a boundary
         * that un-draws itself because somebody scrolled is worse than a
         * boundary that never animated. A clock, though, starts when the
         * element is painted, which for a section at the foot of the page is
         * long before anyone reaches it. `Arrived` supplies the missing half:
         * one observer, fired once, publishing `data-arrived` for the
         * stylesheet to sequence off. It hides nothing and clips nothing, so an
         * observer that never speaks costs the flourish and not the form.
         *
         * `-30%` rather than the measured `-12%`: twelve percent is the right
         * trigger for a *reveal*, where the subject is a line or a card. This
         * subject is a four-hundred-pixel form, and when its top edge is 12%
         * inside the viewport its three rules are all still under the fold —
         * the sequence would play where nobody is looking.
         */}
        <Arrived className={styles.arrival} rootMargin="0px 0px -30% 0px">
          <form
            className={styles.form}
            onSubmit={onSubmit}
            noValidate
            aria-label="Send a message"
            aria-describedby="contact-note"
            /*
             * The resolution, as one attribute.
             *
             * It is set in the same React commit that puts the receipt in the
             * live region, which is what makes the ordering rule structural
             * rather than a matter of timing: the confirmation is in the DOM
             * and announced before the first frame that moves on account of it.
             * It is an attribute and not a class because the stylesheet reads
             * it as a state of the form, which is what it is.
             */
            data-sent={status.kind === "sent" ? "true" : undefined}
          >
            <p id="contact-note" className={`${styles.note} text-fact`}>
              I&rsquo;m employed full-time and not looking for freelance work. I do read
              everything &mdash; if you&rsquo;re hiring, building something you think
              I&rsquo;d find interesting, or want to talk about anything on this page,
              write to me.
            </p>

            {/*
             * NAME — a name is one short answer written in one stroke, so its
             * rule is the length of the answer rather than of the measure, and
             * the ink crosses it once from left to right with nothing else
             * moving.
             *
             * `minLength` mirrors the schema's `min(2)` rather than restating
             * it: it is what tells assistive technology the constraint, and
             * `noValidate` keeps it from blocking the handler, so there is
             * still exactly one validator deciding anything.
             */}
            <div className={`${styles.field} ${styles.fieldName}`}>
              <label className={styles.fieldLabel} htmlFor="contact-name">
                Name
              </label>
              <input
                id="contact-name"
                name="name"
                type="text"
                required
                minLength={2}
                autoComplete="name"
                className={styles.control}
                aria-invalid={fieldErrors.name ? true : undefined}
                aria-describedby={fieldErrors.name ? errorId("name") : undefined}
              />
              {/* The ink layer, and the only reason it is an element: `input`
                  and `textarea` do not render `::before` or `::after`, so the
                  mark that lies over a field's rule has to be a box of its
                  own. It carries no text and no state a reader needs, which is
                  what `aria-hidden` says. */}
              <span aria-hidden="true" className={`${styles.ink} ${styles.inkName}`} />
              {fieldErrors.name && (
                <p id={errorId("name")} className={styles.fieldError}>
                  {fieldErrors.name}
                </p>
              )}
            </div>

            {/*
             * EMAIL — an address is the one answer that can be fully present
             * and still wrong, so its rule is inked from both ends inward and
             * left open at the centre, and the gap is closed by a mark that
             * appears only once the address is a well-formed one.
             *
             * The seal is `:user-valid` in CSS and nothing in JavaScript. It
             * costs no state and no keystroke handler, and the browser decides
             * when to answer: Chrome sets the interacted flag as the reader
             * leaves the field and tracks it live after that, which is the
             * right moment anyway — judging an address somebody is still
             * halfway through typing is the nagging this mark exists not to be.
             *
             * `pattern` is here because `type="email"` alone and the schema
             * disagree, and that was measured rather than assumed: `dana@exam`
             * satisfies the HTML email type, which wants no top-level domain,
             * and fails `ContactSchema`, whose regex requires a dotted one. So
             * the seal would have closed on an address the submit then
             * rejected — the exact drift a second validator in this file would
             * have caused, arriving through the door marked "no second
             * validator". The pattern adds only the dotted domain, so it is
             * nothing the schema does not already demand and rejects nothing
             * the schema accepts. It is not a validator either way: it decides
             * when a decoration appears, and `noValidate` keeps it out of the
             * submit path entirely.
             *
             * The mark only ever says yes. It is purely additive — it tells the
             * reader something is right and never that something is wrong — so
             * it is not a fourth error channel and does not need announcing.
             * The three channels that report an actual failure are still the
             * only ones that do, and all three still only appear on a submit:
             * `aria-invalid`, the note under the field, and the rule's weight.
             */}
            <div className={`${styles.field} ${styles.fieldEmail}`}>
              <label className={styles.fieldLabel} htmlFor="contact-email">
                Email
              </label>
              <input
                id="contact-email"
                name="email"
                type="email"
                required
                pattern="[^@\s]+@[^@\s]+\.[^@\s]{2,}"
                autoComplete="email"
                spellCheck={false}
                autoCapitalize="off"
                className={styles.control}
                aria-invalid={fieldErrors.email ? true : undefined}
                aria-describedby={fieldErrors.email ? errorId("email") : undefined}
              />
              <span aria-hidden="true" className={`${styles.ink} ${styles.inkEmail}`} />
              {fieldErrors.email && (
                <p id={errorId("email")} className={styles.fieldError}>
                  {fieldErrors.email}
                </p>
              )}
            </div>

            {/*
             * MESSAGE — this is the only field where the reader does real work,
             * so it takes the whole measure and it claims more room as it is
             * used, growing to hold what they write instead of asking them to
             * scroll inside a five-line box; its ink opens outward from the
             * centre because it is the one answer with no fixed end.
             *
             * `rows` stays for the browsers without `field-sizing`, which get
             * exactly the box that is here today.
             */}
            <div className={`${styles.field} ${styles.fieldMessage}`}>
              <label className={styles.fieldLabel} htmlFor="contact-message">
                Message
              </label>
              <textarea
                id="contact-message"
                name="message"
                rows={5}
                required
                minLength={10}
                className={`${styles.control} ${styles.message}`}
                aria-invalid={fieldErrors.message ? true : undefined}
                aria-describedby={fieldErrors.message ? errorId("message") : undefined}
              />
              <span aria-hidden="true" className={`${styles.ink} ${styles.inkMessage}`} />
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
        </Arrived>

        <p className={styles.direct}>
          Or write to <a href={`mailto:${contact.email}`}>{contact.email}</a> from
          wherever you keep your mail.
        </p>
      </Rise>

      {/*
       * The full stop, and it is outside the `Rise` on purpose.
       *
       * Inside, it would be a fourth child of the group and would inherit the
       * group's `animation` shorthand, which would overwrite the one it
       * declares for itself — two animations on one element, one of them
       * progress-driven, resolved by whichever stylesheet Vite happened to
       * inject second. Outside, it owns its own clock, and it should: this mark
       * is not part of the plate's arrival. It is the last thing on the page,
       * and it is drawn as the reader arrives at it.
       *
       * It is the one progress-driven mark in this section, which is what gives
       * the `@supports not (animation-timeline: view())` block in the
       * stylesheet something real to do. Reversal — scrolling back up un-draws
       * it — is not a defect here the way it would be on a field rule: this is
       * a decorative hairline that is not the boundary of anything, which is
       * the same licence every other drawn rule on the site has.
       */}
      <span aria-hidden="true" className={styles.closing} />
    </section>
  );
}
