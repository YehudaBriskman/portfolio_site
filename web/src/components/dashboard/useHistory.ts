import { useCallback, useEffect, useState, type RefObject } from "react";
import { isForeignKey, stepIndex } from "@/components/dashboard/history";
import { copyText } from "@/lib/share";

/*
 * The area history's two hooks (#225): a copy status shared by every row,
 * and the `j`/`k` path through the list.
 */

/**
 * One polite live region for the page, and which row's button last copied.
 * A region per row would announce nothing reliably and repeat itself.
 */
export function useCopyStatus(): {
  copied: string | null;
  message: string;
  copy: (key: string, text: string, ok: string, failed: string) => Promise<void>;
} {
  const [copied, setCopied] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(null), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);
  const copy = useCallback(async (key: string, text: string, ok: string, failed: string) => {
    const done = await copyText(text);
    setCopied(done ? key : null);
    setMessage(done ? ok : failed);
  }, []);
  return { copied, message, copy };
}

/**
 * `j` / `k` through the rows, Enter to open. Focus moves to the row's title
 * link, so Enter is the link's own and Tab carries on from wherever `j` left
 * off: nothing is trapped. The listener ignores typing, modified keys, and
 * anything inside an open dialog or a share menu.
 */
export function useListKeys(list: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "j" && e.key !== "k") return;
      if (e.defaultPrevented || isForeignKey(e)) return;
      if ((e.target as HTMLElement | null)?.closest?.("[data-share-menu]")) return;
      const root = list.current;
      if (!root) return;
      const links = [...root.querySelectorAll<HTMLAnchorElement>("[data-row-link]")];
      if (links.length === 0) return;
      const active = document.activeElement;
      const current = links.findIndex((a) => a.closest("[data-note-row]")?.contains(active) ?? false);
      const next = stepIndex(current, e.key === "j" ? 1 : -1, links.length);
      e.preventDefault();
      links[next]?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [list]);
}
