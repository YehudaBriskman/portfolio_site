import type { ReactNode } from "react";
import { AlertTriangle, Ban, Check, ChevronRight, PauseCircle, type LucideIcon } from "lucide-react";
import styles from "@/components/ui/Journey.module.css";
import { useVisualWords } from "@/i18n/visuals";

/*
 * Two drawings of "where is this going / where is it up to".
 *
 * Journey: from -> to (with optional waypoints) as a row of icon discs on a
 * line. The DOM order is from, then to, and the row is a flex row, so under
 * dir="rtl" "from" sits on the start (right) side with no per-language code;
 * the arrowhead is the only mirrored glyph.
 *
 * LifecycleStepper: a vertical list of the stages a record passes through,
 * with the current one announced (aria-current="step" plus a spoken word).
 *
 * The drawing is decoration. Every fact in it is also text in the list, so
 * the lists read the same to a screen reader as to an eye.
 */

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(" ");

export interface JourneyEnd {
  icon: LucideIcon;
  label: string;
  /** A second, quieter line: a count, an address kind. */
  sub?: string;
}

export type JourneyState = "idle" | "active" | "done" | "failed";

export interface JourneyProps {
  from: JourneyEnd;
  to: JourneyEnd;
  /** Stops between the two ends, in order. */
  waypoints?: JourneyEnd[];
  /** A pill centred on the line: a time, a count. */
  via?: ReactNode;
  state?: JourneyState;
  className?: string;
}

function Node({ end, role, children }: { end: JourneyEnd; role?: string; children?: ReactNode }) {
  const Icon = end.icon;
  return (
    <li className={styles.node}>
      <span className={styles.disc}>
        <Icon aria-hidden="true" className={styles.glyph} />
      </span>
      <span className={styles.text}>
        {role ? <span className={styles.role}>{role}</span> : null}
        <bdi className={styles.label}>{end.label}</bdi>
        {end.sub ? <bdi className={styles.sub}>{end.sub}</bdi> : null}
        {children}
      </span>
    </li>
  );
}

export function Journey({ from, to, waypoints = [], via, state = "idle", className }: JourneyProps) {
  const w = useVisualWords();
  const count = waypoints.length + 2;
  const status =
    state === "failed" ? { Icon: AlertTriangle, word: w.stateFailed } :
    state === "done" ? { Icon: Check, word: w.stateDone } :
    state === "active" ? { Icon: null, word: w.stateActive } :
    null;
  return (
    <div className={cx(styles.journey, className)} style={{ ["--n" as string]: count }} data-state={state}>
      <span className={styles.line} data-journey-line="" aria-hidden="true">
        {via ? <span className={styles.via}>{via}</span> : null}
        <ChevronRight className={styles.head} />
      </span>
      <ol className={styles.nodes} aria-label={w.journey(from.label, to.label)} data-state={state}>
        <Node end={from} role={w.from} />
        {waypoints.map((p, i) => (
          <Node key={i} end={p} />
        ))}
        <Node end={to} role={w.to}>
          {status ? (
            <span className={styles.status} data-tone={state}>
              {status.Icon ? <status.Icon aria-hidden="true" className={styles.statusGlyph} /> : null}
              {status.word}
            </span>
          ) : null}
        </Node>
      </ol>
    </div>
  );
}

/* ───────────────────────────────────────────────────── lifecycle stepper */

export interface LifecycleStep {
  id: string;
  label: string;
  /** Optional line under the label: a date, a count. */
  detail?: string;
}

export type LifecycleBranch = "paused" | "failed" | "canceled";

export interface LifecycleStepperProps {
  steps: LifecycleStep[];
  /** The id of the step the record is at. Omit for none (not started). */
  current?: string;
  /** A side branch off the current step; not a step of its own. */
  branch?: LifecycleBranch;
  /** The list's accessible name. */
  label?: string;
  className?: string;
}

const BRANCH_ICON: Record<LifecycleBranch, LucideIcon> = {
  paused: PauseCircle,
  failed: AlertTriangle,
  canceled: Ban,
};

export function LifecycleStepper({ steps, current, branch, label, className }: LifecycleStepperProps) {
  const w = useVisualWords();
  const at = steps.findIndex((s) => s.id === current);
  const branchWord = { paused: w.branchPaused, failed: w.branchFailed, canceled: w.branchCanceled };
  return (
    <ol className={cx(styles.stepper, className)} aria-label={label}>
      {steps.map((step, i) => {
        const mark = at === -1 ? "upcoming" : i < at ? "done" : i === at ? "current" : "upcoming";
        const word = mark === "done" ? w.stepDone : mark === "current" ? w.stepCurrent : w.stepUpcoming;
        const Branch = branch ? BRANCH_ICON[branch] : null;
        return (
          <li key={step.id} className={styles.step} data-mark={mark} aria-current={mark === "current" ? "step" : undefined}>
            <span className={styles.stepMark} data-step-mark={mark} aria-hidden="true">
              {mark === "done" ? <Check className={styles.stepCheck} /> : null}
            </span>
            <span className={styles.stepText}>
              <span className={styles.stepLabel}>{step.label}</span>
              <span className={styles.stepWord}>{word}</span>
              {step.detail ? <span className={styles.sub}>{step.detail}</span> : null}
              {mark === "current" && branch && Branch ? (
                <span className={styles.branch} data-step-branch={branch}>
                  <Branch aria-hidden="true" className={styles.statusGlyph} />
                  {branchWord[branch]}
                </span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
