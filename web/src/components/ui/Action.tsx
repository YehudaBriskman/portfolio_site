import type { MouseEventHandler, ReactNode } from "react";
import { Link } from "react-router-dom";
import styles from "@/components/ui/Action.module.css";

/*
 * One component for every action on the public site.
 *
 * It exists because the treatment it carries is not in index.css yet: the
 * type, the height and the three tones all live in the module beside this
 * file, and the call sites should not have to know that. When the rules are
 * promoted into `.btn` this component keeps its signature and only its
 * `className` changes, so no call site moves twice.
 *
 * Deliberately not polymorphic. A generic `as` prop would need the element's
 * own props spread through it, which is where these components reach for
 * `any`; the three shapes an action is ever asked to take are a route, a URL
 * and a handler, so those are the three the props describe by name.
 */

/** How loud the action is. Exactly one `solid` per screen. */
export type ActionTone = "solid" | "outline" | "text";

/**
 * The mark that follows the label. Named rather than passed as a string so
 * the component can move it in the direction it points, and so a call site
 * cannot quietly introduce a fourth arrow.
 */
export type ActionGlyph = "onward" | "down" | "back" | "out";

const GLYPH: Record<ActionGlyph, string> = {
  onward: "→",
  down: "↓",
  back: "←",
  out: "↗",
};

const TONE: Record<ActionTone, string> = {
  solid: styles.solid,
  outline: styles.outline,
  text: styles.text,
};

export type ActionProps = {
  children: ReactNode;
  tone?: ActionTone;
  glyph?: ActionGlyph;
  className?: string;
  /** An internal route. Renders a react-router `<Link>`. */
  to?: string;
  /** A URL. Renders an `<a>`, opened in a new tab when it leaves the site. */
  href?: string;
  /** With neither `to` nor `href`, renders a `<button type="button">`. */
  onClick?: MouseEventHandler<HTMLElement>;
  disabled?: boolean;
  "aria-label"?: string;
};

export default function Action({
  children,
  tone = "outline",
  glyph,
  className = "",
  to,
  href,
  onClick,
  disabled = false,
  "aria-label": ariaLabel,
}: ActionProps) {
  const cls = `${styles.action} ${TONE[tone]} ${className}`.trim();

  /* The mark sits on the side it points to. A back arrow printed after the
     word reads as "Projects, and then leftwards", which is nothing. */
  const mark = glyph && (
    <span aria-hidden="true" className={`${styles.glyph} ${styles[glyph]}`}>
      {GLYPH[glyph]}
    </span>
  );
  const label = <span className={styles.label}>{children}</span>;
  const body =
    glyph === "back" ? (
      <>
        {mark}
        {label}
      </>
    ) : (
      <>
        {label}
        {mark}
      </>
    );

  if (to !== undefined) {
    return (
      <Link to={to} className={cls} onClick={onClick} aria-label={ariaLabel}>
        {body}
      </Link>
    );
  }

  if (href !== undefined) {
    /* A hash or a relative path is somewhere on this site and must not open a
       tab; anything with a scheme is leaving and must carry the noopener pair.
       Deciding it here is what removed `target`/`rel` from a dozen call sites,
       where one of them was eventually going to be forgotten. */
    const external = /^[a-z][a-z0-9+.-]*:/i.test(href);
    return (
      <a
        href={href}
        className={cls}
        onClick={onClick}
        aria-label={ariaLabel}
        {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
      >
        {body}
      </a>
    );
  }

  return (
    <button type="button" className={cls} onClick={onClick} disabled={disabled} aria-label={ariaLabel}>
      {body}
    </button>
  );
}
