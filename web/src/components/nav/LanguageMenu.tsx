import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import styles from "../Nav.module.css";
import { isLocaleCode, LOCALES, type LocaleCode } from "./locale";

/**
 * The language control.
 *
 * It exists before the translations do because the shape of the chrome is the
 * thing being decided here, and a controls island with one control in it is
 * not the object this nav is trying to be. It is also the honest place to say
 * out loud that the site is English-only today — see `applyLocale` in
 * `locale.ts` for why the second entry is disabled rather than absent.
 *
 * Presentational: the selected code is owned by the nav, because this menu
 * appears both in the controls island and in the mobile sheet.
 */
export default function LanguageMenu({
  value,
  onSelect,
}: {
  value: LocaleCode;
  onSelect: (code: LocaleCode) => void;
}) {
  const current = LOCALES.find((l) => l.code === value) ?? LOCALES[0];

  return (
    /*
     * `modal={false}`, and it fixes a visible bug rather than being a
     * preference.
     *
     * Radix's modal dropdown engages a scroll lock: `overflow: hidden` on
     * `body`, which stops body's overflow propagating to the viewport and
     * makes body its own scroll container. Measured on the live site at
     * 1440px: `#root` and everything under it went from 1440px to 1425px the
     * instant the menu opened, while `body` stayed 1440 — so fifteen pixels
     * of paper appeared down the right-hand edge, full height, with the dark
     * act no longer reaching it. On a page that hard-cuts between a cream
     * ground and a near-black one, that strip is the most visible thing on
     * the screen.
     *
     * The lock is also the wrong instrument here. A language picker is a
     * popover, not a modal: it does not need the document frozen behind it,
     * and freezing it costs a relayout of the entire page to show four
     * words. The mobile sheet still locks scroll, because a full-screen menu
     * genuinely is modal.
     *
     * Everything the modal mode was providing that this menu actually needs
     * — focus moving into the content, Escape, click-outside, focus
     * returning to the trigger — Radix keeps in non-modal mode. What is given
     * up is the scroll lock and the outside-pointer block, and both of those
     * are behaviours a dropdown should not have had.
     */
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="glass"
          size="island"
          className={styles.control}
          /*
           * The accessible name has to contain the visible text.
           *
           * This read "Language: English" while the button showed "EN", so a
           * speech-input user saying "click EN" matched nothing — WCAG 2.5.3,
           * Label in Name. Naming it from the visible string and letting the
           * icon carry the rest keeps both audiences pointed at the same
           * word.
           */
          aria-label={`${current.short} — change language`}
        >
          <Languages aria-hidden="true" />
          <span>{current.short}</span>
        </Button>
      </DropdownMenuTrigger>

      {/* `align="end"` keeps the panel on screen: the trigger is the last
          control in the right-hand island, so a centre-aligned menu would
          hang off the edge of a narrow window. The collision padding is for
          the other copy of this control, the one in the mobile sheet — there
          the trigger sits near the left of a 390px screen and Radix pushed
          the panel flush against x: 0, touching the edge of the phone. */}
      <DropdownMenuContent
        align="end"
        sideOffset={10}
        collisionPadding={12}
        className={styles.menu}
      >
        <DropdownMenuLabel className={styles.menuHead}>Language</DropdownMenuLabel>
        <DropdownMenuSeparator className={styles.menuSplit} />
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => {
            // Radix hands back a bare string; narrow it rather than asserting,
            // so a locale removed from the list cannot survive here.
            if (isLocaleCode(next)) onSelect(next);
          }}
        >
          {LOCALES.map((l) => (
            <DropdownMenuRadioItem
              key={l.code}
              value={l.code}
              disabled={!l.available}
              className={styles.menuItem}
            >
              <span dir={l.dir}>{l.label}</span>
              {/* Says why it cannot be chosen at the moment someone tries. A
                  disabled item with no explanation reads as a bug. */}
              {!l.available && (
                <DropdownMenuShortcut className={styles.menuNote}>soon</DropdownMenuShortcut>
              )}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
