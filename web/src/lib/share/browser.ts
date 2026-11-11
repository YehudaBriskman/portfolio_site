type ShareNavigator = Pick<Navigator, "share" | "canShare"> | undefined;

/**
 * Web Share where the browser has it, and a fallback otherwise.
 *
 *   "shared"    the system sheet took it
 *   "cancelled" the reader closed the sheet; nothing more to do
 *   "fallback"  no Web Share, or it refused: show the menu
 */
export async function shareLink(
  data: { url: string; title: string; text?: string },
  nav: ShareNavigator = typeof navigator === "undefined" ? undefined : navigator,
): Promise<"shared" | "cancelled" | "fallback"> {
  if (!nav || typeof nav.share !== "function") return "fallback";
  if (typeof nav.canShare === "function" && !nav.canShare(data)) return "fallback";
  try {
    await nav.share(data);
    return "shared";
  } catch (e) {
    return e instanceof Error && e.name === "AbortError" ? "cancelled" : "fallback";
  }
}

/** Copies text; false when the clipboard is unavailable or refused. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.clipboard) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
