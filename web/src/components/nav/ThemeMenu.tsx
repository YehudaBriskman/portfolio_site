import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/lib/theme";
import { isThemeChoice, type ThemeChoice } from "@/lib/themeDefault";
import styles from "../Nav.module.css";

/*
 * Light, Dark or System (#247), beside the language and the motion pause.
 *
 * The same shape as `LanguageMenu`: a Radix menu with a radio group, which
 * brings the APG menu-button pattern (arrow keys, Escape, focus back on the
 * trigger) and announces the current choice as checked. The trigger shows
 * the CHOICE's icon rather than the resolved theme's, so a reader on System
 * sees that it is System; its name says both, because "System" alone does
 * not tell a screen-reader user which ground they are on.
 *
 * No state here: `lib/theme.ts` is one store for the document, so the copy of
 * this control in the bar and the one in the phone's side panel cannot
 * disagree.
 */
const OPTIONS: { value: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

export default function ThemeMenu() {
  const { choice, resolved, setChoice } = useTheme();
  const current = OPTIONS.find((o) => o.value === choice) ?? OPTIONS[2];
  const name =
    choice === "system"
      ? `Theme: System, now ${resolved === "dark" ? "Dark" : "Light"} — change theme`
      : `Theme: ${current.label} — change theme`;

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="glass" size="island" className={styles.control} aria-label={name} title={name}>
          <current.Icon aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={10} collisionPadding={12} className={styles.menu}>
        <DropdownMenuLabel className={styles.menuHead}>Theme</DropdownMenuLabel>
        <DropdownMenuSeparator className={styles.menuSplit} />
        <DropdownMenuRadioGroup
          value={choice}
          onValueChange={(next) => {
            if (isThemeChoice(next)) setChoice(next);
          }}
        >
          {OPTIONS.map(({ value, label, Icon }) => (
            <DropdownMenuRadioItem key={value} value={value} className={styles.menuItem}>
              <Icon aria-hidden="true" className="size-4" />
              <span>{label}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
