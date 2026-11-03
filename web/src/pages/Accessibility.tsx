import { Link } from "react-router-dom";
import PageShell from "@/components/PageShell";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useContent } from "@/content/store";
import { sectionVisible } from "@/settings/schema";
import { useSiteSettings } from "@/settings/store";

/*
 * The accessibility statement (issue #99).
 *
 * WHY THERE IS ONE
 *
 * Israeli law asks a site that serves the public for a statement under
 * regulation 35ה of the Service Accessibility Regulations: what was done, and
 * how to report what was not. Whether a personal portfolio is a "service" in
 * the regulation's sense, and whether its operator falls under a turnover
 * exemption in 35ו, is a legal question this file does not answer. It is
 * published anyway because it costs one route, because the reporting channel
 * it names is worth having whatever the law says, and because the issue asked
 * for a visible, reachable statement of what the Pause control does — which
 * belongs here rather than in a tooltip that only a pointer or a focus ring
 * ever opens.
 *
 * WHAT THE OWNER STILL HAS TO CONFIRM
 *
 * The reporting address is the one the footer and the contact section
 * already publish; nothing new is invented. No accessibility coordinator is
 * named: section 19מב of the Act requires one only of an operator with at
 * least 25 employees, and this site has one author. If either changes, this
 * is the one file to edit. The date below is the audit's, and moves when the
 * audit in `docs/accessibility/audit.md` is re-run.
 *
 * WHAT IT DELIBERATELY DOES NOT SAY
 *
 * "Fully compliant", or a badge. The audit is the author's, not a certified
 * accessibility expert's, and the page says so — a statement that overclaims
 * is worse than none, because it is the one page a reader who is already
 * having trouble will trust.
 */

const REVIEWED = "2 November 2026";

export default function Accessibility() {
  useDocumentTitle("Accessibility");
  const { contact } = useContent().site;
  /* The form lives on the home page; hidden there (#254), it is not offered. */
  const contactShown = sectionVisible(useSiteSettings(), "contact");

  return (
    <PageShell>
      <section className="wrap section-y">
        <p className="eyebrow">Statement</p>
        <h1 className="display mt-3 text-section">Accessibility</h1>

        <div className="mt-8 max-w-[68ch] space-y-5 text-[1.0625rem] leading-relaxed text-ink">
          <p>
            This site aims to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level
            AA, which includes the Israeli standard IS 5568 (WCAG 2.0 at level AA). It was last
            audited on {REVIEWED}, by me, the site&rsquo;s author. That audit is not a
            certification by an accessibility professional.
          </p>

          <h2 className="display display-md pt-6 text-object">What is in place</h2>
          <ul className="list-disc space-y-2 ps-6">
            <li>
              Every page works with a keyboard alone. The first key press reaches a link that
              skips straight to the content, and focus is always visible.
            </li>
            <li>
              Pages are built from headings and landmarks a screen reader can move between, and
              every image that carries meaning has a text description.
            </li>
            <li>
              Text and controls are measured for contrast against the ground they sit on,
              including the one dark section.
            </li>
            <li>
              The layout holds at 320 pixels wide and at 400% zoom without scrolling sideways,
              and survives a reader&rsquo;s own line, letter and word spacing.
            </li>
            <li>
              The contact form names every field, says which one needs a change and what the
              change is, and announces whether the message was sent.
            </li>
          </ul>

          <h2 className="display display-md pt-6 text-object">Motion, and the Pause button</h2>
          <p>
            Parts of the site move, and they move with your scrolling: as a section comes up it
            settles a few pixels into place and a small circle draws itself by its heading, and
            both undo on the way back up. Nothing is ever drawn over the text as it arrives.
            Apart from a short curtain over the window while a page first loads, and replies to
            what you click, tap or point at, nothing moves on its own. There are two ways to stop
            all of it.
          </p>
          <ul className="list-disc space-y-2 ps-6">
            <li>
              If your device is set to reduce motion, the site already honours it and nothing
              animates.
            </li>
            <li>
              Otherwise, the <strong>Pause motion</strong> button in the top bar (inside the menu
              on a phone) stops every animation on every page, and the site remembers the choice
              on this device. Press it again to let things move.
            </li>
          </ul>
          <p>Nothing on the site flashes, and no content is only available while it moves.</p>

          <h2 className="display display-md pt-6 text-object">Changing how the site looks</h2>
          <p>
            The theme button in the top bar (inside the menu on a phone) opens one menu with three
            settings. The site remembers each one on this device, and each can be reached and
            changed with the keyboard: Enter or Space opens the menu, the arrow keys move, and
            Escape closes it.
          </p>
          <ul className="list-disc space-y-2 ps-6">
            <li>
              <strong>Theme:</strong> Light, Dark, or System to follow your device.
            </li>
            <li>
              <strong>Text size:</strong> Default, Large (about 12% bigger) or Larger (25%
              bigger). This is on top of your browser&rsquo;s own zoom, which works as well.
            </li>
            <li>
              <strong>Contrast:</strong> Standard, More, or System to follow your device&rsquo;s
              &ldquo;increase contrast&rdquo; setting. More darkens the secondary text, the
              outlines and the dividers, and thickens the focus ring.
            </li>
          </ul>

          <h2 className="display display-md pt-6 text-object">Known limitations</h2>
          <ul className="list-disc space-y-2 ps-6">
            <li>
              The site is in English only. A Hebrew version is listed in the language menu but
              is not available yet.
            </li>
            <li>
              Wide tables inside notes scroll sideways on a narrow screen. They can be reached
              and scrolled with the keyboard.
            </li>
            <li>
              The audit was checked with automated tools, a keyboard and the browser&rsquo;s
              accessibility tree. It has not yet been checked with a screen reader on every
              platform.
            </li>
          </ul>

          <h2 className="display display-md pt-6 text-object">Reporting a problem</h2>
          <p>
            If something here does not work for you, or you need it in another form, write to{" "}
            <a className="underline underline-offset-4" href={`mailto:${contact.email}`}>
              {contact.email}
            </a>
            {contactShown ? (
              <>
                {" "}or use the{" "}
                <Link className="underline underline-offset-4" to="/#contact">
                  contact form
                </Link>
              </>
            ) : null}
            . Say which page and what happened; I will answer, and fix what can be fixed, as
            soon as I can.
          </p>

          <p className="mono pt-6 text-xs text-clay">Statement last updated {REVIEWED}.</p>
        </div>
      </section>
    </PageShell>
  );
}
