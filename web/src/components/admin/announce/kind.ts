/*
 * An event kind a newer server sends and this build has no word or icon for
 * reads as a plain announcement ("custom"): a neutral glyph and label, so one
 * odd event never blanks the inbox.
 */
export const kindWord = <K extends string>(kinds: Record<K, string>, kind: string): string => (kinds as Record<string, string>)[kind] ?? (kinds as Record<string, string>).custom;

export const kindIcon = <T>(icons: Record<string, T>, kind: string): T => icons[kind] ?? icons.custom;
