import { useEffect, useRef } from "react";
import { SubscribeError } from "@/services/subscribe";

/** A 4xx means this link is dead; anything else (network, 5xx, rate limit) is worth trying again. */
export const isDeadLink = (e: unknown): boolean => e instanceof SubscribeError && e.kind === "invalid";

/** The failure to keep while the reader retries ("rate" has its own words). */
export const retryKind = (e: unknown): "rate" | "reach" => (e instanceof SubscribeError && e.kind === "rate" ? "rate" : "reach");

/** Moves focus to the retry button when a failure appears, so a keyboard or screen-reader reader lands on the way forward. */
export function useFocusWhen(active: boolean) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (active) ref.current?.focus();
  }, [active]);
  return ref;
}
