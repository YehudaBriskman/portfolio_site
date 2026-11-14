import type { SiteSettings } from "@/settings/schema";

/*
 * How a saved version differs from the live one. One entry per difference, so
 * the count a row prints and the lines in its sheet are the same number by
 * construction. The desktop's "N differences from now" uses the same list.
 */

export type Change =
  | { kind: "section"; index: number; id: string; visible: boolean }
  | { kind: "visual"; key: "theme" | "motion" | "accent"; value: string }
  | { kind: "sharing" };

export function changesBetween(then: SiteSettings, now: SiteSettings): Change[] {
  const out: Change[] = [];
  then.home.sections.forEach((s, i) => {
    const o = now.home.sections[i];
    if (!o || o.id !== s.id || o.visible !== s.visible) out.push({ kind: "section", index: i, id: s.id, visible: s.visible });
  });
  for (const key of ["theme", "motion", "accent"] as const) {
    if (then.visuals[key] !== now.visuals[key]) out.push({ kind: "visual", key, value: then.visuals[key] });
  }
  if (JSON.stringify(then.sharing) !== JSON.stringify(now.sharing)) out.push({ kind: "sharing" });
  return out;
}
