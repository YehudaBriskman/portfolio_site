import { useId, useRef } from "react";
import { Circle, Contrast, Monitor, Moon, SlidersHorizontal, Sun, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import styles from "./DisplayMenu.module.css";
import Segmented from "./Segmented";
import { isLocaleCode, LOCALES, type LocaleCode } from "./locale";
import { centreOf, changeTheme } from "./themeWave";
import { useChromeWords } from "@/i18n/chrome";

/**
 * Everything the chrome lets you change about how the site behaves, as
 * opposed to where you are in it. One object, because these always travel
 * together and are handed both to the bar's popover and to the phone's sheet.
 */
export type NavControls = {
  locale: LocaleCode;
  onSelectLocale: (code: LocaleCode) => void;
  motionPaused: boolean;
  onToggleMotion: () => void;
};

/*
 * One display control, in place of three.
 *
 * The bar used to carry a language menu, a theme menu (which also held text
 * size and contrast) and a motion toggle: three triggers, two kinds of popup
 * and one bare button for what is, to the reader, one question: "how do I
 * want this page to look and move?" It is now a single trigger that opens a
 * single panel, grouped and labelled:
 *
 *   Language    segmented   English | עברית
 *   Theme       segmented   Light | Dark | System
 *   Text size   segmented   Default | Large | Larger
 *   Contrast    segmented   Standard | More | System
 *   ----------
 *   Pause motion   switch
 *
 * Choices are segmented because they are few and all worth seeing at once;
 * the motion pause is a switch because it is on or off. A menu was the wrong
 * widget for this (the APG menu pattern allows only menu items inside), so
 * this is a Popover: non-modal, so there is no scroll lock and no 15px strip
 * of paper down the edge of the page (the reason the old menus were
 * `modal={false}`), with Escape, outside-press and focus returning to the
 * trigger all kept.
 *
 * The panel is also rendered on its own (`DisplayPanel`) inside the phone's
 * sheet, where a popover on top of a sheet would be a popup on a popup.
 *
 * `controls` is optional: the admin shell has no language switch and no
 * motion pause of its own, and the panel simply leaves those two rows out.
 *
 * A theme change spreads from whichever segment was pressed
 * (`themeWave.ts`).
 *
 * The trigger keeps the `data-language-trigger` hook: after a language change
 * the route remounts the bar and `focusLanguageControl` puts focus back here.
 */

const THEMES: { value: ThemeChoice; word: "themeLight" | "themeDark" | "themeSystem"; Icon: typeof Sun }[] = [
  { value: "light", word: "themeLight", Icon: Sun },
  { value: "dark", word: "themeDark", Icon: Moon },
  { value: "system", word: "themeSystem", Icon: Monitor },
];

/* The size options' icon is an "A" set at the size the option gives, so the row
   reads as a scale. */
const SIZES: { value: TextSize; word: "textDefault" | "textLarge" | "textLarger"; px: number }[] = [
  { value: "default", word: "textDefault", px: 12 },
  { value: "large", word: "textLarge", px: 15 },
  { value: "larger", word: "textLarger", px: 18 },
];

const CONTRASTS: {
  value: ContrastChoice;
  word: "contrastStandard" | "contrastMore" | "themeSystem";
  Icon: typeof Sun;
}[] = [
  { value: "standard", word: "contrastStandard", Icon: Circle },
  { value: "more", word: "contrastMore", Icon: Contrast },
  { value: "system", word: "themeSystem", Icon: Monitor },
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <h3 id={id} className={styles.label}>
        {title}
      </h3>
      {children}
    </section>
  );
}

export function DisplayPanel({
  controls,
  originRef,
  inline = false,
}: {
  /** In the phone sheet: no popover around it, so it aligns to the sheet's own edge. */
  inline?: boolean;
  controls?: NavControls;
  /** Where a theme wave starts when no segment of the panel has focus. */
  originRef?: React.RefObject<Element | null>;
}) {
  const w = useChromeWords();
  const { choice } = useTheme();
  const prefs = useViewerPrefs();
  const uid = useId();
  const panel = useRef<HTMLDivElement>(null);
  const id = (k: string) => `${uid}-${k}`;

  const origin = () => {
    const active = document.activeElement;
    return centreOf(active && panel.current?.contains(active) ? active : (originRef?.current ?? null));
  };

  return (
    <div ref={panel} className={styles.panel} data-inline={inline || undefined}>
      {controls && (
        <Section id={id("lang")} title={w.language}>
          <Segmented
            labelledBy={id("lang")}
            value={controls.locale}
            options={LOCALES.map((l) => ({ value: l.code, label: l.label, lang: l.code, dir: l.dir }))}
            onChange={(next) => {
              // Narrowed rather than asserted, so a locale removed from the
              // list cannot survive here.
              if (isLocaleCode(next)) controls.onSelectLocale(next);
            }}
          />
        </Section>
      )}

      <Section id={id("theme")} title={w.theme}>
        <Segmented
          stacked
          labelledBy={id("theme")}
          value={choice}
          options={THEMES.map(({ value, word, Icon }) => ({ value, label: w[word], icon: <Icon /> }))}
          onChange={(next) => {
            if (isThemeChoice(next)) changeTheme(next, origin());
          }}
        />
      </Section>

      <Section id={id("size")} title={w.textSize}>
        <Segmented
          stacked
          labelledBy={id("size")}
          value={prefs.textSize}
          options={SIZES.map(({ value, word, px }) => ({
            value,
            label: w[word],
            icon: (
              <span className={styles.glyph} style={{ fontSize: `${px}px` }}>
                A
              </span>
            ),
          }))}
          onChange={(next) => {
            if (isTextSize(next)) setTextSize(next);
          }}
        />
      </Section>

      <Section id={id("contrast")} title={w.contrast}>
        <Segmented
          stacked
          labelledBy={id("contrast")}
          value={prefs.contrast}
          options={CONTRASTS.map(({ value, word, Icon }) => ({ value, label: w[word], icon: <Icon /> }))}
          onChange={(next) => {
            if (isContrastChoice(next)) setContrast(next);
          }}
        />
      </Section>

      {controls && (
        /*
         * A switch, not a toggle button: it is a setting that is on or off.
         * The whole row is the control (a 44px target, label included), and
         * `aria-checked` is "paused", the thing the name says, so the
         * announcement is "Pause motion, switch, on" when motion is stopped
         * (the same rule the old toggle's `aria-pressed` followed: the name
         * never flips).
         */
        <button
          type="button"
          role="switch"
          aria-checked={controls.motionPaused}
          className={styles.switchRow}
          onClick={controls.onToggleMotion}
        >
          <span className={styles.switchLabel}>{w.pauseMotion}</span>
          <span className={styles.track} aria-hidden="true">
            <span className={styles.thumb} />
          </span>
        </button>
      )}
    </div>
  );
}

export default function DisplayMenu({ controls }: { controls?: NavControls }) {
  const { choice, resolved } = useTheme();
  const prefs = useViewerPrefs();
  const w = useChromeWords();
  const trigger = useRef<HTMLButtonElement>(null);
  const theme =
    choice === "system"
      ? w.systemNow(resolved === "dark" ? w.themeDark : w.themeLight)
      : w[(THEMES.find((o) => o.value === choice) ?? THEMES[2]).word];
  const size = w[SIZES.find((o) => o.value === prefs.textSize)?.word ?? "textDefault"];
  const contrast =
    prefs.contrast === "system"
      ? w.systemNow(prefs.resolvedContrast === "more" ? w.contrastMore : w.contrastStandard)
      : prefs.contrast === "more"
        ? w.contrastMore
        : w.contrastStandard;
  const name = w.displayName(theme, size, contrast);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          ref={trigger}
          variant="glass"
          size="islandIcon"
          className={`${nav.control} ${nav.controlIcon}`}
          aria-label={name}
          title={name}
          data-language-trigger=""
        >
          <SlidersHorizontal aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      {/* `align="end"`: the trigger is the last control in the bar, so a
          centred panel would hang off the edge of a narrow window. */}
      <PopoverContent align="end" sideOffset={10} collisionPadding={12} className={styles.pop}>
        <div className="pop-head">
          <h2 className="pop-title">{w.displaySettings}</h2>
          <PopoverClose className={styles.close} aria-label={w.close}>
            <X aria-hidden="true" />
          </PopoverClose>
        </div>
        <DisplayPanel controls={controls} originRef={trigger} />
      </PopoverContent>
    </Popover>
  );
}
