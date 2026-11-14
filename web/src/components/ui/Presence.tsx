import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import { EXIT_KEEP_MS, usePhoneMotion } from "@/hooks/usePhoneMotion";
import styles from "@/components/ui/Presence.module.css";

/*
 * A surface that arrives and leaves softly on a phone: the toast, the bulk bar.
 *
 * `show` is the state and it flips on the event. When it goes false the last
 * content is kept for the length of the exit, marked `data-state="closed"`,
 * `inert` and `aria-hidden`, and the stylesheet fades it down; a timer then
 * drops it. The timer only removes a leftover, it never decides open or
 * closed, so a throttled or cancelled animation cannot leave anything stuck:
 * the closed node is inert and `display: none` whatever the animation did.
 * Where the stylesheet will not animate (desktop, reduced motion) nothing is
 * kept and the node goes at once.
 */

export interface PresenceProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  show: boolean;
  children?: ReactNode;
}

export function Presence({ show, children, className, ...rest }: PresenceProps) {
  const motion = usePhoneMotion();
  const [last, setLast] = useState<ReactNode>(children);
  if (show && last !== children) setLast(children);
  const [leaving, setLeaving] = useState(false);
  const [was, setWas] = useState(show);
  if (show !== was) {
    setWas(show);
    setLeaving(!show && motion);
  }
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => setLeaving(false), EXIT_KEEP_MS);
    return () => clearTimeout(t);
  }, [leaving]);

  if (!show && !leaving) return null;
  return (
    <div
      {...rest}
      className={[styles.presence, className].filter(Boolean).join(" ")}
      data-state={show ? "open" : "closed"}
      inert={!show}
      aria-hidden={show ? rest["aria-hidden"] : true}
    >
      {show ? children : last}
    </div>
  );
}
