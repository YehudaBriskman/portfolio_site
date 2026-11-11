type ShareNavigator = Pick<Navigator, "share" | "canShare"> | undefined;

/**
 * Web Share where the browser has it, and a fallback otherwise.
 *
 *   "shared"    the system sheet took it
 *   "cancelled" the reader closed the sheet; nothing more to do
 *   "fallback"  no Web Share, or it refused: show the menu
 */
export async function shareLink(
  data: { url: string; title: string; text?: string; files?: File[] },
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

/** Saves the card at `url` as a file; false when it cannot be fetched. */
export async function downloadImage(url: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const href = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = href;
    a.download = "share-card.png";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 10_000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Copies a formatted block as text/html plus text/plain, so a mail composer
 * keeps the layout; plain text where the browser has no ClipboardItem.
 * Returns what landed on the clipboard, or false.
 */
export async function copyRich(content: { html: string; text: string }): Promise<"rich" | "plain" | false> {
  try {
    if (typeof navigator === "undefined" || !navigator.clipboard) return false;
    if (typeof ClipboardItem !== "undefined" && typeof navigator.clipboard.write === "function") {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([content.html], { type: "text/html" }),
            "text/plain": new Blob([content.text], { type: "text/plain" }),
          }),
        ]);
        return "rich";
      } catch {
        /* refused: fall through to plain text */
      }
    }
    await navigator.clipboard.writeText(content.text);
    return "plain";
  } catch {
    return false;
  }
}
