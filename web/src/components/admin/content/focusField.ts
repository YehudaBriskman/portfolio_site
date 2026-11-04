import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/*
 * Arriving at one field (#302). The Translations page links each row to the
 * field it is about: `/admin/site-copy#field=hero.title`. Once the document
 * has loaded, the editor finds the field by its path (`data-path`, set by
 * the field components), scrolls it into view and focuses its Hebrew input,
 * since that is the side the link is about.
 *
 * A path deeper than any field (`decisions.0.body` inside a list the form
 * draws as one block) falls back to the nearest field that holds it. The
 * field may draw a moment after the document loads (a project picked from
 * the query string), so the lookup retries for a few seconds on a timer.
 */

function find(path: string): HTMLElement | null {
  const parts = path.split(".");
  while (parts.length) {
    const el = document.querySelector<HTMLElement>(`[data-path="${CSS.escape(parts.join("."))}"]`);
    if (el) return el;
    parts.pop();
  }
  return null;
}

function target(field: HTMLElement): HTMLElement {
  return (
    field.querySelector<HTMLElement>('[lang="he"]:is(input, textarea)') ??
    field.querySelector<HTMLElement>("input, textarea, select, button") ??
    field
  );
}

export function useFocusField<T>(value: T | null, resolve?: (value: T, field: string, query: URLSearchParams) => string) {
  const { hash, search } = useLocation();
  const loaded = value !== null;
  const latest = useRef({ value, resolve });
  useLayoutEffect(() => {
    latest.current = { value, resolve };
  });

  useEffect(() => {
    const m = /^#field=(.+)$/.exec(hash);
    const { value: v, resolve: r } = latest.current;
    if (!loaded || !m || v === null) return;
    const field = decodeURIComponent(m[1]);
    const path = r ? r(v, field, new URLSearchParams(search)) : field;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const look = () => {
      const el = find(path);
      if (el) {
        el.scrollIntoView({ block: "center" });
        target(el).focus({ preventScroll: true });
        return;
      }
      if (++tries < 16) timer = setTimeout(look, 250);
    };
    look();
    return () => clearTimeout(timer);
  }, [loaded, hash, search]);
}
