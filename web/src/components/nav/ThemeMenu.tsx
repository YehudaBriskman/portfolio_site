import { useRef, type ReactNode } from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, Circle, Contrast, Monitor, Moon, Sun } from "lucide-react";
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
import {
  isContrastChoice,
  isTextSize,
  setContrast,
  setTextSize,
  useViewerPrefs,
  type ContrastChoice,
  type TextSize,
} from "@/lib/viewerPrefs";
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
 *
 * Text size and contrast (#99) are two more radio groups in this same menu,
 * from `lib/viewerPrefs.ts`, rather than a second "accessibility" button.
 * They are the same kind of choice as the theme (how the page looks to this
 * reader), and a widget that re-offered the theme and the motion pause beside
 * the real ones would be two switches for one setting. Motion stays the Pause
 * toggle beside this menu: it is one press, and burying it a menu deep would
 * make the commonest request the slowest. The trigger's name lists all three
 * settings, so a screen-reader user hears what is behind it.
 */

const OPTIONS: { value: ThemeChoice; word: "themeLight" | "themeDark" | "themeSystem"; Icon: typeof Sun }[] = [
  { value: "light", word: "themeLight", Icon: Sun },
  { value: "dark", word: "themeDark", Icon: Moon },
  { value: "system", word: "themeSystem", Icon: Monitor },
];

/* The size rows' icon is an "A" set at the size the row gives, so the column
   reads as a scale. */
const SIZES: { value: TextSize; word: "textDefault" | "textLarge" | "textLarger"; px: number }[] = [
  { value: "default", word: "textDefault", px: 11 },
  { value: "large", word: "textLarge", px: 13 },
  { value: "larger", word: "textLarger", px: 15 },
];

const CONTRAST_OPTIONS: {
  value: ContrastChoice;
  word: "contrastStandard" | "contrastMore" | "themeSystem";
  Icon: typeof Sun;
}[] = [
  { value: "standard", word: "contrastStandard", Icon: Circle },
  { value: "more", word: "contrastMore", Icon: Contrast },
  { value: "system", word: "themeSystem", Icon: Monitor },
];

function Row({ value, label, icon }: { value: string; label: string; icon: ReactNode }) {
  return (
    <DropdownMenuPrimitive.RadioItem value={value} className={styles.row}>
      <span className={styles.mark} aria-hidden="true">
        <DropdownMenuPrimitive.ItemIndicator>
          <Check strokeWidth={2.5} />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
      <span>{label}</span>
    </DropdownMenuPrimitive.RadioItem>
  );
}

export default function ThemeMenu() {
  const { choice, resolved } = useTheme();
  const prefs = useViewerPrefs();
  const w = useChromeWords();
  const trigger = useRef<HTMLButtonElement>(null);
  const current = OPTIONS.find((o) => o.value === choice) ?? OPTIONS[2];
  const theme =
    choice === "system" ? w.systemNow(resolved === "dark" ? w.themeDark : w.themeLight) : w[current.word];
  const size = w[SIZES.find((o) => o.value === prefs.textSize)?.word ?? "textDefault"];
  const contrast =
    prefs.contrast === "system"
      ? w.systemNow(prefs.resolvedContrast === "more" ? w.contrastMore : w.contrastStandard)
      : prefs.contrast === "more"
        ? w.contrastMore
        : w.contrastStandard;
  const name = w.displayName(theme, size, contrast);

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
            <Row key={value} value={value} label={w[word]} icon={<Icon />} />
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator className={`${nav.menuSplit} ${styles.split}`} />
        <DropdownMenuLabel className={`${nav.menuHead} ${styles.head}`}>{w.textSize}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={prefs.textSize}
          onValueChange={(next) => {
            if (isTextSize(next)) setTextSize(next);
          }}
        >
          {SIZES.map(({ value, word, px }) => (
            <Row
              key={value}
              value={value}
              label={w[word]}
              icon={
                <span className={styles.glyph} style={{ fontSize: `${px}px` }}>
                  A
                </span>
              }
            />
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator className={`${nav.menuSplit} ${styles.split}`} />
        <DropdownMenuLabel className={`${nav.menuHead} ${styles.head}`}>{w.contrast}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={prefs.contrast}
          onValueChange={(next) => {
            if (isContrastChoice(next)) setContrast(next);
          }}
        >
          {CONTRAST_OPTIONS.map(({ value, word, Icon }) => (
            <Row key={value} value={value} label={w[word]} icon={<Icon />} />
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
