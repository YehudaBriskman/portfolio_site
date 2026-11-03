import { useRef } from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/lib/theme";
import { isThemeChoice, type ThemeChoice } from "@/lib/themeDefault";
import nav from "../Nav.module.css";
import styles from "./ThemeMenu.module.css";
import { centreOf, changeTheme } from "./themeWave";
import { useChromeWords } from "@/i18n/chrome";

/*
 * Light, Dark or System (#247), beside the language and the motion pause.
 *
 * A Radix menu with a radio group, which brings the APG menu-button pattern
 * (arrow keys, Escape, focus back on the trigger) and renders each row as
 * `menuitemradio` with `aria-checked`. The trigger shows the CHOICE's icon
 * rather than the resolved theme's, so a reader on System sees that it is
 * System; its name says both, because "System" alone does not tell a
 * screen-reader user which ground they are on.
 *
 * The rows are Radix's own item, not the shadcn wrapper: that one hangs the
 * indicator in the row's padding at `left-2`, which is what made the menu
 * look unaligned (#266). Here the check has a column of its own; see
 * ThemeMenu.module.css.
 *
 * A change spreads from this trigger as a circle (`themeWave.ts`, #266),
 * from wherever the trigger is — the bar's or the phone panel's copy.
 *
 * No state here: `lib/theme.ts` is one store for the document, so the copy of
 * this control in the bar and the one in the phone's side panel cannot
 * disagree.
 */
const OPTIONS: { value: ThemeChoice; word: "themeLight" | "themeDark" | "themeSystem"; Icon: typeof Sun }[] = [
  { value: "light", word: "themeLight", Icon: Sun },
  { value: "dark", word: "themeDark", Icon: Moon },
  { value: "system", word: "themeSystem", Icon: Monitor },
];

export default function ThemeMenu() {
  const { choice, resolved } = useTheme();
  const w = useChromeWords();
  const trigger = useRef<HTMLButtonElement>(null);
  const current = OPTIONS.find((o) => o.value === choice) ?? OPTIONS[2];
  const name =
    choice === "system"
      ? w.themeSystemName(resolved === "dark" ? w.themeDark : w.themeLight)
      : w.themeName(w[current.word]);

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          ref={trigger}
          variant="glass"
          size="island"
          className={nav.control}
          aria-label={name}
          title={name}
        >
          <current.Icon aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={10}
        collisionPadding={12}
        className={`${nav.menu} ${styles.menu}`}
      >
        <DropdownMenuLabel className={`${nav.menuHead} ${styles.head}`}>{w.theme}</DropdownMenuLabel>
        <DropdownMenuSeparator className={`${nav.menuSplit} ${styles.split}`} />
        <DropdownMenuRadioGroup
          value={choice}
          onValueChange={(next) => {
            if (isThemeChoice(next)) changeTheme(next, centreOf(trigger.current));
          }}
        >
          {OPTIONS.map(({ value, word, Icon }) => (
            <DropdownMenuPrimitive.RadioItem key={value} value={value} className={styles.row}>
              <span className={styles.mark} aria-hidden="true">
                <DropdownMenuPrimitive.ItemIndicator>
                  <Check strokeWidth={2.5} />
                </DropdownMenuPrimitive.ItemIndicator>
              </span>
              <span className={styles.icon} aria-hidden="true">
                <Icon />
              </span>
              <span>{w[word]}</span>
            </DropdownMenuPrimitive.RadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
