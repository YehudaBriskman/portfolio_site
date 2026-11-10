import { useEffect, useRef, useState } from "react";
import type { FormEvent, MouseEvent } from "react";
import ObjectLabel from "@/components/gallery/ObjectLabel";
import { MAX_FIELDS, type LabelField } from "@/components/gallery/objectLabel";
import Written from "@/components/motion/Written";
import styles from "@/components/Contact.module.css";
import type { SocialLink } from "@/data/links";
import { useContent } from "@/content/store";
import { ContactSchema, sendContactMessage } from "@/services/contact";
import { useContactWords, useHomeWords } from "@/i18n/pages";
import Arrow from "@/i18n/Arrow";

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

/* The dialog's accessible name comes from the heading inside it, so the two
   have to agree on one id and there is no second place to change it. */
const TITLE_ID = "contact-dialog-title";

/*
 * The field line, built from data rather than typed out.
 *
 * The brief for this plate listed four fields — EMAIL, GITHUB, LINKEDIN and
 * the reply time — and the schema caps a label at three. Four is a datasheet,
 * which is what the project blocks were before they were cut back, so one had
 * to go and EMAIL is the one that earns its place least: the address itself is
 * printed under the ask, in the line that says where to write if the form is
 * not wanted. A spec that states what the sentence below it plainly says is
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

const plateFieldsOf = (links: SocialLink[], contact: { replyWithin: string }): LabelField[] => [
  ...links.slice(0, PROFILE_SLOTS).map((l): LabelField => ({ kind: "where", value: l.label })),
  { kind: "when", value: contact.replyWithin },
];

/*
 * The collection's last plate, and the one object on the page you can open.
 *
 * It is the final object in the gallery, labelled with the same three-part
 * schema as every project and every note — name, one line of fact, a field
 * line — rendered through the same `ObjectLabel` they are, at the same scale.
 * That is the whole idea and it survives this rewrite unchanged: the ask reads
 * as part of the collection rather than as the moment the catalog stops and the
 * sales page starts.
 *
 * What changed is that the form is no longer printed on the plate. The section
 * is the plate, one paragraph and one button, and the three fields live in a
 * dialog behind that button. The cost of that is stated plainly because it is
 * real: a form the reader has to open is a form fewer readers fill in. What it
 * buys is that the last screen of a gallery is a labelled object with a single
 * action on it instead of four hundred pixels of input boxes, and that the
 * three answers are asked for in a place built for answering them.
 *
 * What was cut from the *plan* for this section, and what was kept: the whole
 * card was to fold once and fly off the top of the window on send. That is
 * gone and stays gone — the engineered peak is the pile, and a page with three
 * peaks has none, so the budget that would have bought the fold is spent two
 * sections up. The other half of that plan, the fields inking in as ruled
 * lines, is built and moved into the dialog intact: it costs no frame budget,
 * nothing about it exits, and it is the one place on this page where an
 * animation can carry information rather than emphasis.
 *
 * Three fields, three treatments, and the difference is the structure
 * -------------------------------------------------------------------
 * A name, an address and a message are three different kinds of input, and a
 * per-field effect is only worth having if it says which is which. Three
 * easings is not that. So each field differs in the two things a reader can
 * actually read — the room the field claims and the way the ink arrives on
 * its foot — and the full sentence for each sits beside it in the stylesheet.
 *
 * The one restraint from the cut plan, and the thing the dialog puts at risk
 * -------------------------------------------------------------------------
 * THE CONFIRMATION LANDS BEFORE OR WITH ANY MOTION, NEVER AFTER IT. A card
 * that leaves and then says it worked looks like it ate the message.
 *
 * A dialog is the obvious way to break that rule, because the obvious thing to
 * do on a successful send is to close it — which is exit motion, racing an
 * announcement that has just been queued, in a subtree that is about to be
 * taken out of the accessibility tree. So the dialog does not close itself. It
 * holds the receipt, announced in a region that has been in its subtree since
 * its first paint, and the reader dismisses it when they have read it. Nothing
 * in this section exits, which is the same guarantee the printed form had and
 * the reason the rule is satisfied by construction rather than by timing.
 *
 * And it has to *resolve*. The last feeling is the one the reader carries off
 * the page, so the close cannot trail away into a footer — whatever the peak
 * did gets overwritten by whatever the ending does. A button on an empty stage
 * resolves nothing, so three marks do that work and all three are additive:
 * the three field rules, which inked in three different ways, re-ink as one
 * stroke under the receipt — the three answers leaving as one message; the section itself changes state behind the dialog, so that closing
 * it leaves a statement where the ask was rather than the page the reader
 * started on; and the section signs off with a rule across the column ending
 * in a printer's end-mark, which fills once a message has actually gone.
 */
export default function Contact() {
  /* The copy and the profiles from the content store (#163). */
  const { contact, links } = useContent().site;
  const plateFields = plateFieldsOf(links, contact);
  const w = useContactWords();
  const home = useHomeWords();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  /*
   * Three booleans, and they are three different questions.
   *
   * `open` is whether the dialog should be showing. It is a mirror of the
   * element's own `open` attribute rather than the source of truth for it —
   * Escape is handled by the browser, so the element can close without passing
   * through here, and the `close` listener below is what puts the two back in
   * step. Anything that reads the element's state asks the element.
   *
   * `everOpened` is whether the form has been asked for yet, and it is what
   * keeps the form out of the first render: the dialog element is in the
   * document from the start, empty, and its subtree mounts the first time the
   * button is pressed. It never goes back to false, which is deliberate and is
   * about the one thing a reader cannot recover. Escape is a single keystroke
   * and easy to hit by accident; if closing the dialog unmounted the fields,
   * that keystroke would throw away the paragraph they had just written.
   * Closing hides the dialog, and reopening it finds every word where it was.
   *
   * `answered` is whether a message has ever actually left. It outlives the
   * status — which is reset when a sent dialog is closed, so that reopening it
   * offers a fresh form — because the section's resolution has to outlive the
   * dialog that announced it.
   */
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const [answered, setAnswered] = useState(false);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  /* Where the press that may become a backdrop click started. See the handler. */
  const pressedBackdrop = useRef(false);

  /*
   * `showModal`, and nothing hand-rolled on top of it.
   *
   * Focus trapping, the top layer, an inert background and Escape are all
   * things this one call does correctly and all things a hand-written modal
   * gets wrong — a focus trap in particular is a loop over a list of selectors
   * that is wrong the first time somebody puts a `<summary>` or a
   * `contenteditable` inside it. `dialog.show()` would give the top layer and
   * none of the rest, which is the trap that looks like the same thing.
   *
   * Focus is moved explicitly rather than with `autofocus`. The dialog's own
   * focusing steps pick the first focusable thing in it, which is correct here
   * only by luck of document order, and React applies an `autoFocus` attribute
   * by calling `focus()` on mount — which happens in this same commit, before
   * `showModal` has put the element in the top layer. One explicit call after
   * the dialog is showing is the version with no race in it.
   *
   * The refs are attached before effects run, so the field being focused here
   * is the one that mounted in the commit that set `open`.
   */
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      /* An engine with `<dialog>` but no `showModal` gets the panel without
         the top layer rather than no form at all: the stylesheet keys its
         layout off `[open]`, so the attribute alone renders a usable, if
         non-modal, dialog. Nothing below depends on which of the two ran. */
      if (!dialog.open) {
        if (typeof dialog.showModal === "function") dialog.showModal();
        else dialog.setAttribute("open", "");
      }
      firstFieldRef.current?.focus();
      return;
    }

    if (dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else {
        dialog.removeAttribute("open");
        dialog.dispatchEvent(new Event("close"));
      }
    }
  }, [open]);

  /*
   * One listener for every way out.
   *
   * Escape, the close button, a backdrop click and a programmatic close all
   * end at the element's `close` event, so focus returns to the trigger in one
   * place rather than in four — and the one route that cannot be intercepted,
   * Escape, is the one that would have been forgotten.
   *
   * `setStatus` takes a function rather than reading `status`, which is what
   * lets this listener be installed once and never see a stale value. The
   * reset is conditional and the condition is the whole point: a sent message
   * leaves a fresh form behind, and a failed one keeps every word of itself,
   * its notes and its alert, so that reopening the dialog shows the reader
   * exactly what they were looking at.
   */
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const onClose = () => {
      setOpen(false);
      triggerRef.current?.focus();
      setStatus((s) => (s.kind === "sent" ? { kind: "idle" } : s));
    };

    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, []);

  /*
   * A press that starts on the backdrop and ends on the backdrop.
   *
   * A plain click handler comparing `event.target` to the dialog is the usual
   * way to close on a backdrop click and it has one bug that matters here: a
   * drag that begins inside the panel and ends outside it — selecting the
   * paragraph you have just written, and overshooting — reports the dialog as
   * the click target and closes it. Nothing is lost when that happens, because
   * the fields survive a close, but a form that vanishes while you are
   * selecting your own text is still the form's fault.
   */
  const onPanelMouseDown = (e: MouseEvent<HTMLDialogElement>) => {
    pressedBackdrop.current = e.target === dialogRef.current;
  };

  const onPanelClick = (e: MouseEvent<HTMLDialogElement>) => {
    if (pressedBackdrop.current && e.target === dialogRef.current) setOpen(false);
  };

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
      /* The schema's own messages are English; the reader's language has
         the same three, one per field. */
      setFieldErrors({
        name: flat.name?.[0] && w.errors.name,
        email: flat.email?.[0] && (draft.email.trim() === "" ? w.errors.emailEmpty : w.errors.email),
        message: flat.message?.[0] && w.errors.message,
      });
      setStatus({
        kind: "failed",
        message: w.invalid,
      });
      /*
       * Focus deliberately does not move to the first bad field.
       *
       * It is the obvious courtesy and it breaks the thing above it: moving
       * focus queues the new field's own announcement, which on several screen
       * readers cuts off the alert that has just been inserted — so the reader
       * is taken to a field and never told why. The alert is the announcement
       * and the per-field notes are what `aria-describedby` reads out when they
       * arrive there themselves. The same argument is why a successful send
       * does not move focus to the close button, which is otherwise exactly
       * where a reader who is finished wants to be.
       */
      return;
    }

    setFieldErrors({});
    setStatus({ kind: "sending" });

    try {
      await sendContactMessage(parsed.data);
      /*
       * The confirmation first, the reset second, and all of it in one update.
       *
       * React batches these into a single commit, so the receipt reaches the
       * live region in the same paint that empties the fields and marks the
       * section answered — the reader is never shown a cleared form with
       * nothing to explain it, and no frame of the closing gesture runs before
       * the text that explains it is in the DOM. The order is written this way
       * round anyway, because it is the order the rule is stated in and the
       * next person to add a step here should have to step over it.
       *
       * What this handler does not do is close the dialog. See the head of the
       * file: an exit that races its own announcement is the one way left to
       * break the only rule this section inherited from the cut plan.
       */
      setStatus({ kind: "sent" });
      setAnswered(true);
      el.reset();
    } catch (err) {
      /*
       * Nothing is cleared and nothing is closed on a failure. Not an
       * oversight — the one thing a reader cannot recover is the paragraph
       * they just wrote, and a form that empties itself, or a dialog that
       * shuts itself, when the send fails has thrown away the only copy of the
       * message it was asked to deliver.
       */
      const reason = err instanceof Error ? err.message : w.unknownFailure;
      setStatus({
        kind: "failed",
        message: w.failed(reason, contact.email),
      });
    }
  }

  /* Rendered under the field it belongs to, and referenced from it. The id is
     derived from the name so the two can never drift apart. */
  const errorId = (name: FieldName) => `contact-${name}-error`;

  return (
    <section id="contact" className="wrap section-y">
      {/*
       * `surface`, beat 6 of the device ledger in docs/motion-contract.md
       * (#160). It used to be `reveal` — `motion/Rise`, an observer that fired
       * once — and the house rule is now that scroll is the clock: every
       * arrival is scrubbed by scroll position and reversed exactly when the
       * reader scrolls back up. So each part of the plate rises out of its own
       * baseline on its own `view()` timeline, and the paragraph takes the pen
       * like every other paragraph on the site. All of it is CSS; this
       * component holds no motion state.
       *
       * `.plate` is the box the focus rule reads: a keyboard reader who lands
       * on the button mid-arrival gets the whole plate arrived at once.
       *
       * The dialog is not a seventh beat and does not get a family. It is
       * this beat continued — the same object, opened — and it answers a
       * press rather than a scroll, so it is the one thing here on a clock.
       */}
      <div className={styles.plate}>
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
        {/*
         * `className` and not a prop on the component, which is the whole of
         * how centring is said on this site: the label does not know it is
         * centred, the section does. The three declarations it takes and why
         * one of them alone looks broken are on `.label` in
         * `Contact.module.css`.
         */}
        <ObjectLabel
          scale="object"
          nameAs="h2"
          name={home.getInTouch}
          fact={w.fact}
          fields={plateFields}
          className={styles.label}
        />

        {/*
         * The ask: one paragraph and one button.
         *
         * The paragraph used to be the form's `aria-describedby`, read out
         * before the first field. It belongs here now and not in the dialog,
         * for the reason it was written: it is what decides whether somebody
         * writes at all. A reader who has pressed the button has already made
         * that decision, and reading it to them again on the way in is the
         * dialog telling them what they just agreed to.
         *
         * It is also what keeps this from being a button on an empty stage.
         * The section is a labelled object with a fact line, a sentence that
         * says who should write, an action, and an address for anyone who
         * would rather not use it — which is more text than the printed form
         * had above its first field.
         */}
        <div className={styles.ask}>
          <Written as="p" className={`${styles.note} text-fact`}>
            {w.note}
          </Written>

          {/*
           * The section's own half of the receipt, and it is not a live region.
           *
           * The announcement happened in the dialog, in a region that was
           * subscribed to before there was anything to say. This is what is
           * left on the page after the dialog goes, and it has to exist:
           * without it, closing the dialog returns the reader to the exact page
           * they started on, which is the "looks like it ate the message"
           * failure arriving one step later than it used to.
           *
           * It is mounted in the same commit as the receipt, so it cannot be
           * late. It carries no motion of its own, which is the one decision
           * here worth stating: at the moment it appears the reader is inside
           * the dialog and this is behind an inert backdrop, so a 14px rise
           * would be a gesture played where nobody is looking. It is simply
           * arrived by the time they can see it.
           */}
          {answered && (
            <p className={`${styles.signoff} ${styles.surface}`}>
              <strong>{w.sent}</strong>
            </p>
          )}

          {/*
           * One button, and it is the same `.btn .btn-solid` every primary
           * action on this site already is. No magnet: a control that moves
           * away from the pointer is a joke told once, and the ledger bans the
           * family outright.
           *
           * It goes quiet once a message has gone. The ask has been answered,
           * so the statement above is what the section is now about and a
           * second message is a secondary action — and demoting it is also
           * what stops the last screen reading as though nothing had happened.
           * The element itself never changes, only its label and its variant,
           * because this is where focus comes back to when the dialog closes
           * and a trigger that unmounts on send is a trigger that drops focus
           * on the floor.
           */}
          <button
            ref={triggerRef}
            type="button"
            className={`btn ${answered ? "btn-quiet" : "btn-solid"} ${styles.open} ${styles.surface}`}
            onClick={() => {
              setEverOpened(true);
              setOpen(true);
            }}
          >
            {answered ? w.writeAnother : w.write}
            <span aria-hidden="true"><Arrow /></span>
          </button>
        </div>

        <p className={`${styles.direct} ${styles.surface}`}>
          {w.directBefore}{" "}
          <a href={`mailto:${contact.email}`} dir="ltr">
            {contact.email}
          </a>{" "}
          {w.directAfter}
        </p>
      </div>

      {/*
       * The dialog, outside the plate: nothing in the top layer may sit inside
       * a box that is being clipped and translated by a scroll timeline.
       *
       * `aria-labelledby` and not `aria-label`, so the name the reader is told
       * on the way in is the heading they can see. The heading repeats the
       * trigger's own words rather than paraphrasing them, which is the
       * cheapest way to make a dialog feel like the thing that was pressed
       * instead of a new place.
       *
       * The element is here from the first render and empty until the button
       * is pressed. That is what "the form is not in the initial render path"
       * means in practice, and it is also what makes the live regions inside
       * it correct: they are in the dialog's subtree from that subtree's first
       * paint, which is the only "first paint" a screen reader subscribing to
       * this dialog ever sees.
       */}
      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby={TITLE_ID}
        onMouseDown={onPanelMouseDown}
        onClick={onPanelClick}
      >
        {everOpened && (
          /*
           * The panel opens and closes on a transition in the stylesheet
           * (`.dialog[open] .panel` and its `@starting-style`), not on a class
           * set here: the open is the `open` attribute, so there is one source
           * of truth for whether the dialog is showing and the animation
           * cannot disagree with it.
           */
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <h2 id={TITLE_ID} className={styles.panelTitle}>
                  {w.write}
                </h2>
                {/* Said once, here, so no field needs a "required" mark of
                    its own. */}
                <p className={styles.panelLede}>
                  {w.allThree} {contact.replyWithin}.
                </p>
              </div>
              {/* A visible way out for a pointer, next to the two the browser
                  already gives — Escape and the backdrop. It is `.btn-quiet`
                  cut down to the 44px tap floor: a dismiss is secondary, and a
                  56px pill in a dialog header competes with the send. */}
              <button
                type="button"
                className={`btn btn-quiet ${styles.dismiss}`}
                onClick={() => setOpen(false)}
              >
                {w.close}
              </button>
            </div>

            {/*
             * The scrolling half of the panel, and it is why there is a panel
             * at all rather than a form with a border.
             *
             * At 390px with a soft keyboard up, the whole of the top layer is
             * roughly half a phone screen. The head stays put, this box
             * scrolls, and the browser's own "scroll the focused field into
             * view" lands inside it — which is the behaviour a single
             * overflowing dialog does not get, because there the head scrolls
             * away with everything else and the way out goes with it.
             */}
            <div className={styles.panelBody}>
              {/*
               * `noValidate`, with `required` and `type="email"` left on the
               * fields.
               *
               * The attributes stay: they are what tells assistive technology
               * that a field is required and what kind of keyboard a phone
               * should offer. The native *bubble* goes. It shows for a few
               * seconds and then disappears, it is announced inconsistently,
               * it cannot be given a contrast ratio, and it blocks the submit
               * handler — so the legible, announced, persistent errors this
               * form draws itself would only ever be seen by someone whose
               * browser had already given up on them.
               *
               * There is no gate component around the fields any more and none
               * is needed. The rules are drawn on a clock, because a view
               * timeline runs backwards when the reader scrolls up and these
               * rules are the controls' own boundaries; a clock starts when the
               * element is painted, which used to be long before anyone reached
               * the foot of the page, and an `IntersectionObserver` was what
               * supplied the missing half. In a dialog the two coincide: this
               * subtree is painted at the moment the reader asks for it, so
               * opening the dialog *is* the gate.
               */}
              <form
                className={styles.form}
                onSubmit={onSubmit}
                noValidate
                aria-label={w.formLabel}
                /*
                 * The resolution, as one attribute.
                 *
                 * It is set in the same React commit that puts the receipt in
                 * the live region, which is what makes the ordering rule
                 * structural rather than a matter of timing: the confirmation
                 * is in the DOM and announced before the first frame that
                 * moves on account of it. It is an attribute and not a class
                 * because the stylesheet reads it as a state of the form,
                 * which is what it is.
                 */
                data-sent={status.kind === "sent" ? "true" : undefined}
              >
                {/*
                 * NAME — a name is one short answer written in one stroke, so
                 * it takes the narrower of the two columns, and the ink
                 * crosses its foot once from left to right with nothing else
                 * moving.
                 *
                 * `minLength` mirrors the schema's `min(2)` rather than
                 * restating it: it is what tells assistive technology the
                 * constraint, and `noValidate` keeps it from blocking the
                 * handler, so there is still exactly one validator deciding
                 * anything.
                 *
                 * It is also the field focus lands on when the dialog opens,
                 * which is the only reason it carries a ref.
                 */}
                <div className={`${styles.field} ${styles.fieldName}`}>
                  <label className={styles.fieldLabel} htmlFor="contact-name">
                    {w.name}
                  </label>
                  <input
                    ref={firstFieldRef}
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
                  {/* The ink layer, and the only reason it is an element:
                      `input` and `textarea` do not render `::before` or
                      `::after`, so the mark that lies over a field's rule has
                      to be a box of its own. It carries no text and no state a
                      reader needs, which is what `aria-hidden` says. */}
                  <span aria-hidden="true" className={`${styles.ink} ${styles.inkName}`} />
                  {fieldErrors.name && (
                    <p id={errorId("name")} className={styles.fieldError}>
                      {fieldErrors.name}
                    </p>
                  )}
                </div>

                {/*
                 * EMAIL — an address is the one answer that can be fully
                 * present and still wrong, so its rule is inked from both ends
                 * inward and left open at the centre, and the gap is closed by
                 * a mark that appears only once the address is a well-formed
                 * one.
                 *
                 * The seal is `:user-valid` in CSS and nothing in JavaScript.
                 * It costs no state and no keystroke handler, and the browser
                 * decides when to answer: Chrome sets the interacted flag as
                 * the reader leaves the field and tracks it live after that,
                 * which is the right moment anyway — judging an address
                 * somebody is still halfway through typing is the nagging this
                 * mark exists not to be.
                 *
                 * `pattern` is here because `type="email"` alone and the schema
                 * disagree, and that was measured rather than assumed:
                 * `dana@exam` satisfies the HTML email type, which wants no
                 * top-level domain, and fails `ContactSchema`, whose regex
                 * requires a dotted one. So the seal would have closed on an
                 * address the submit then rejected — the exact drift a second
                 * validator in this file would have caused, arriving through
                 * the door marked "no second validator". The pattern adds only
                 * the dotted domain, so it is nothing the schema does not
                 * already demand and rejects nothing the schema accepts. It is
                 * not a validator either way: it decides when a decoration
                 * appears, and `noValidate` keeps it out of the submit path
                 * entirely.
                 *
                 * The mark only ever says yes. It is purely additive — it tells
                 * the reader something is right and never that something is
                 * wrong — so it is not a fourth error channel and does not need
                 * announcing. The three channels that report an actual failure
                 * are still the only ones that do, and all three still only
                 * appear on a submit: `aria-invalid`, the note under the field,
                 * and the rule's weight.
                 */}
                <div className={`${styles.field} ${styles.fieldEmail}`}>
                  <label className={styles.fieldLabel} htmlFor="contact-email">
                    {w.email}
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
                 * MESSAGE — this is the only field where the reader does real
                 * work, so it takes the whole width and it claims more room
                 * as it is used, growing to hold what they write instead of
                 * asking them to scroll inside a five-line box; its ink opens
                 * outward from the centre because it is the one answer with no
                 * fixed end.
                 *
                 * `rows` stays for the browsers without `field-sizing`, which
                 * get exactly the box that is here today.
                 */}
                <div className={`${styles.field} ${styles.fieldMessage}`}>
                  <label className={styles.fieldLabel} htmlFor="contact-message">
                    {w.message}
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

                {/* Above the send, where the eye is when it fails. */}
                <p role="alert" className={styles.failure}>
                  {status.kind === "failed" ? status.message : null}
                </p>
                <div className={styles.foot}>
                  <button
                    type="submit"
                    disabled={status.kind === "sending"}
                    className="btn btn-solid"
                  >
                    {status.kind === "sending" ? w.sending : w.send}
                    <span aria-hidden="true"><Arrow /></span>
                  </button>

                {/*
                 * Two live regions, both present from this subtree's first
                 * paint and both usually empty.
                 *
                 * They are separate because they are announced differently and
                 * a region cannot change its mind: a receipt is polite and
                 * waits for a gap, a failed send is an alert and does not.
                 * Swapping one element's `role` between the two is the version
                 * of this that silently announces nothing, because the region a
                 * screen reader is watching is the one it saw when the subtree
                 * appeared.
                 *
                 * Neither is created at the moment its text is, for the same
                 * reason. A live region that arrives together with its first
                 * content is a region nobody has subscribed to yet, which loses
                 * the announcement in exactly the case it was written for. In a
                 * dialog that is a sharper rule than it was on a page, not a
                 * softer one: the subtree is created the moment the reader asks
                 * for it, so there is no spare time in which a region could be
                 * added later.
                 */}
                  <p role="status" aria-live="polite" aria-atomic="true" className={styles.status}>
                    {status.kind === "sending" && w.sending}
                    {status.kind === "sent" && (
                      /*
                       * The receipt, and the ordering rule is satisfied by
                       * construction rather than by timing: the text is
                       * committed in the same React update that sets the
                       * state, so the live region has it before any frame
                       * runs, and nothing moves on account of it — there is no
                       * exit motion in this section for it to be late to,
                       * because the dialog does not close itself.
                       */
                      <span className={styles.receipt}>
                        {w.sent}
                      </span>
                    )}
                  </p>
                </div>
              </form>
            </div>
          </div>
        )}
      </dialog>

      {/*
       * The full stop, and it is outside the plate on purpose: it is not
       * part of the plate's arrival. It is the last thing in the section, and
       * it is drawn as the reader arrives at it, on its own timeline.
       *
       * Reversal — scrolling back up un-draws
       * it — is not a defect here the way it would be on a field rule: this is
       * a decorative hairline that is not the boundary of anything, which is
       * the same licence every other drawn rule on the site has.
       *
       * `data-answered` is the quietest of the section's three resolutions: the
       * end-mark goes from soft ink to full ink once a message has actually
       * gone. A full stop that is darker after the page has done its job is
       * worth one declaration; it says nothing a reader has to read, which is
       * why it is allowed to be a colour and nothing else.
       */}
      <span
        aria-hidden="true"
        className={styles.closing}
        data-answered={answered ? "true" : undefined}
      />
    </section>
  );
}
