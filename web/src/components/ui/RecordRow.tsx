import { isValidElement, useId, useRef, type ComponentType, type ReactNode } from "react";
import { ChevronRight, Check, type LucideIcon } from "lucide-react";
import { useMobileWords } from "@/i18n/mobile";
import styles from "@/components/ui/RecordRow.module.css";

/*
 * A phone row answers one question: which one do I open, and does it need me?
 * A leading icon, a title (two lines at most), at most two facts, one status
 * glyph and a chevron. The whole row is ONE button: one tab stop, one target,
 * nothing interactive inside it. Detail belongs in a sheet, not in the row.
 *
 * The button is named by `openLabel` ("Open Launch notes"); the facts, the
 * status and "New" are its description, so a screen reader hears them once
 * the name has been read.
 */

/** A row shows at most this many facts beside its title. */
export const MAX_FACTS = 2;

export type Fact = {
  icon?: LucideIcon;
  text: string;
  /** Spoken before the text when the visible text alone is not enough ("Posted"). */
  label?: string;
  /** "ltr" for an id, a path or an address; the default follows the text. */
  dir?: "ltr" | "auto";
};

export interface RecordRowProps {
  /** The kind icon (a lucide component) or any node, drawn in a tinted 40px circle. */
  icon: LucideIcon | ReactNode;
  title: string;
  facts?: [Fact?, Fact?];
  /** One <StatusGlyph/> or <ChannelRow/>. */
  status?: ReactNode;
  unread?: boolean;
  /** Selection mode: the row becomes a checkbox and the leading icon swaps to a tick box. */
  selectable?: boolean;
  selected?: boolean;
  onOpen: () => void;
  /** Accessible name of the row, e.g. "Open Launch notes". */
  openLabel: string;
  /** Enters selection mode. Never the only way to: pair it with a visible Select button. */
  onLongPress?: () => void;
  trailing?: "chevron" | ReactNode;
  as?: "li" | "div";
  className?: string;
}

const LONG_PRESS_MS = 450;
const MOVE_CANCEL_PX = 8;

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(" ");

function Lead({ icon }: { icon: RecordRowProps["icon"] }) {
  if (icon == null || typeof icon === "string" || typeof icon === "number" || isValidElement(icon)) return <>{icon}</>;
  const Icon = icon as ComponentType<{ size?: number; "aria-hidden"?: boolean; focusable?: string; strokeWidth?: number }>;
  return <Icon size={20} strokeWidth={2} aria-hidden focusable="false" />;
}

export function RecordRow({
  icon, title, facts, status, unread, selectable, selected, onOpen, openLabel, onLongPress,
  trailing = "chevron", as = "div", className,
}: RecordRowProps) {
  const w = useMobileWords().row;
  const descId = useId();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  };

  const shown = (facts ?? []).filter((f): f is Fact => Boolean(f)).slice(0, MAX_FACTS);
  const hasDesc = shown.length > 0 || Boolean(status) || Boolean(unread);

  const button = (
    <button
      type="button"
      data-record-row=""
      data-selected={selectable ? String(Boolean(selected)) : undefined}
      className={cx(styles.row, className)}
      aria-label={openLabel}
      aria-describedby={hasDesc ? descId : undefined}
      role={selectable ? "checkbox" : undefined}
      aria-checked={selectable ? Boolean(selected) : undefined}
      onClick={(e) => {
        if (fired.current) {
          fired.current = false;
          e.preventDefault();
          return;
        }
        onOpen();
      }}
      onPointerDown={(e) => {
        if (!onLongPress || (e.button ?? 0) !== 0) return;
        fired.current = false;
        origin.current = { x: e.clientX, y: e.clientY };
        timer.current = setTimeout(() => {
          timer.current = null;
          fired.current = true;
          onLongPress();
        }, LONG_PRESS_MS);
      }}
      onPointerMove={(e) => {
        const o = origin.current;
        if (o && Math.hypot(e.clientX - o.x, e.clientY - o.y) > MOVE_CANCEL_PX) clear();
      }}
      onPointerUp={clear}
      onPointerCancel={clear}
      onPointerLeave={clear}
      onContextMenu={onLongPress ? (e) => e.preventDefault() : undefined}
    >
      {unread && <span data-rr-unread="" className={styles.dot} aria-hidden="true" />}
      <span className={styles.lead} aria-hidden={selectable ? true : undefined}>
        {selectable ? (
          <span className={styles.box} data-checked={String(Boolean(selected))}>
            {selected && <Check size={16} strokeWidth={3} aria-hidden="true" focusable="false" />}
          </span>
        ) : (
          <Lead icon={icon} />
        )}
      </span>
      <span data-rr-title="" dir="auto" className={styles.title}>
        <bdi>{title}</bdi>
      </span>
      {/* A real space between the title and the facts: a name that says what is shown ("Open Notes, 2 days ago") has to match the visible text, which axe reads with no gap between sibling spans otherwise (WCAG 2.5.3). */}
      {" "}
      <span id={descId} className={styles.desc}>
        {unread && <span className={styles.srOnly}>{w.isNew}</span>}
        {shown.length > 0 && (
          <span className={styles.facts}>
            {shown.map((f, i) => (
              <span key={i} className={cx("rr-fact", styles.fact)}>
                {i > 0 && " "}
                {f.icon && <f.icon size={16} strokeWidth={1.75} aria-hidden="true" focusable="false" />}
                {f.label && <span className={styles.srOnly}>{f.label}: </span>}
                <bdi dir={f.dir ?? "auto"}>{f.text}</bdi>
              </span>
            ))}
          </span>
        )}
        {status ? <span className={styles.status}>{status}</span> : null}
      </span>
      {trailing === "chevron" ? (
        <span data-rr-chevron="" className={styles.chevron}>
          <ChevronRight size={20} strokeWidth={2} aria-hidden="true" focusable="false" />
        </span>
      ) : (
        trailing
      )}
    </button>
  );

  return as === "li" ? <li className={styles.item}>{button}</li> : <div className={styles.item}>{button}</div>;
}
