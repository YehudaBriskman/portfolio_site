/*
 * The tools the site's projects are built with, most used first, version
 * tails folded ("React 19" and "React 18" are one "React"). The orbit's chips
 * are these, so each label is a claim the project data can back.
 */
const VERSION_TAIL = /\s+v?\d+(?:\.\d+)*$/i;

export function topTech(tech: string[][], n: number): string[] {
  const seen = new Map<string, { label: string; count: number }>();
  for (const list of tech) {
    for (const raw of list) {
      const label = raw.replace(VERSION_TAIL, "").trim();
      if (!label) continue;
      const key = label.toLowerCase();
      const hit = seen.get(key);
      if (hit) hit.count += 1;
      else seen.set(key, { label, count: 1 });
    }
  }
  return [...seen.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, n)
    .map((x) => x.label);
}
