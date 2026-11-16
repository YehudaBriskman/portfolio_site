import { useCallback, useEffect, useRef } from "react";
import { PULL_MAX, usePullReveal } from "@/components/ui/pullReveal";
import styles from "@/components/ui/PullTitle.module.css";

/*
 * The phone's page title, shown only while the page is pulled down from its top (#896).
 *
 * It is a decoration for the eye: `aria-hidden`, because the page's real `h1` stays in the document (visually
 * hidden by `.a-main h1` on a phone, still exposed to a screen reader and still the one h1). It moves with
 * transform and opacity only, through one custom property `--pull` (0..1) that this component writes straight
 * to the element, so a pull does no React render and no layout. While a finger is down it follows the finger;
 * on release a CSS transition takes it back, and a timer, not animationend, marks it at rest. For a viewer who
 * asked for less motion it does not slide at all: the title steps in and out by opacity on the same gesture.
 */

const REST_MS = 260;

export function PullTitle({ title, enabled, isBlocked }: { title: string; enabled: boolean; isBlocked?: () => boolean }) {
  const el = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const onChange = useCallback((offset: number, held: boolean) => {
    const node = el.current;
    if (!node) return;
    clearTimeout(timer.current);
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const p = reduce ? (offset > 0 ? 1 : 0) : Math.min(1, offset / PULL_MAX);
    node.style.setProperty("--pull", p.toFixed(3));
    if (held || offset > 0) {
      node.dataset.state = held ? "pull" : "release";
      if (!held) timer.current = setTimeout(() => { node.dataset.state = "rest"; }, REST_MS);
    } else {
      node.dataset.state = "release";
      timer.current = setTimeout(() => { node.dataset.state = "rest"; }, REST_MS);
    }
  }, []);

  usePullReveal({ enabled, isBlocked, onChange });

  if (!enabled) return null;
  return (
    <div ref={el} className={styles.title} data-pull-title="" data-state="rest" aria-hidden="true">
      <span className={styles.text} dir="auto">{title}</span>
    </div>
  );
}
