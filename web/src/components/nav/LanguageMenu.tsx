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
    <DropdownMenu>
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
        <DropdownMenuSeparator />
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
