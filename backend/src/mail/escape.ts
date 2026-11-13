/*
 * THE escape function for everything that goes into a mail. Text and
 * attribute values both use it: it covers the five characters that can open a
 * tag, end an attribute or start an entity. No other file in the mail path
 * escapes by itself.
 */
const MAP: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => MAP[c]);

/** `esc` plus newlines as <br>, for a multi-line value in a text position. */
export const escMulti = (s: string): string => esc(s).replace(/\r?\n/g, "<br>");

/** One header-safe line: no CR/LF or line separators. */
export const oneLine = (s: string): string => s.replace(/[\r\n\u2028\u2029]+/g, " ").trim();
