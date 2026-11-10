import { useCallback, useState } from "react";

/*
 * Whether an `<img>` has arrived, told truthfully (stability, 2026-11-10: "images
 * in the app sometimes aren't loading right").
 *
 * An `onLoad` handler alone has two holes. An image that finished before React
 * attached the handler (a cached file, a server-rendered page, a fast second
 * visit) never fires `load` again, so a picture held at `opacity: 0` until
 * `onLoad` stayed invisible for good. And an image that fails fires `error`,
 * which nothing listened to, so its placeholder pulsed forever. This reads the
 * element's own state on mount and on every `src` change, and listens for both
 * events.
 */
export type ImageState = "loading" | "loaded" | "failed";

export function useImageLoad(srcKey: string) {
  /* Keyed by the file, so a new file starts again from "loading" without an
     effect to reset it. */
  const [seen, setSeen] = useState<{ key: string; state: ImageState }>({ key: srcKey, state: "loading" });
  const state: ImageState = seen.key === srcKey ? seen.state : "loading";

  /* A callback ref, run when the element attaches and again when the file
     changes: it reads what the element already knows. */
  const attach = useCallback(
    (el: HTMLImageElement | null) => {
      if (!el || !el.complete) return;
      if (el.naturalWidth > 0) setSeen({ key: srcKey, state: "loaded" });
      else if (el.currentSrc || el.src) setSeen({ key: srcKey, state: "failed" });
    },
    [srcKey],
  );
  const onLoad = useCallback(() => setSeen({ key: srcKey, state: "loaded" }), [srcKey]);
  const onError = useCallback(() => setSeen({ key: srcKey, state: "failed" }), [srcKey]);
  return { attach, state, onLoad, onError };
}
