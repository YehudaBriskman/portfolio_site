import { ltrValue } from "@/i18n/words";

/* Formatting the admin's lists share (#288). */

/** Bytes as a reader says them: "412 kB", "3.4 MB". */
export function bytes(n: number): string {
  const units = ["byte", "kilobyte", "megabyte", "gigabyte"] as const;
  let i = 0;
  let v = n;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i += 1;
  }
  return ltrValue(
    new Intl.NumberFormat("en-GB", {
      style: "unit",
      unit: units[i],
      unitDisplay: "short",
      maximumFractionDigits: v < 10 && i > 0 ? 1 : 0,
    }).format(v),
  );
}
