/**
 * Renders the static Open Graph cards into the frontend's public/ directory.
 *
 * These are the fallbacks: the site card, and one per top-level area. Individual
 * posts and projects get their own card rendered on demand by /api/og, so this
 * only needs re-running when the template or the wording here changes.
 *
 *   npx tsx scripts/generate-og-assets.ts
 */
import fs from "fs";
import path from "path";
import { renderCardPng, OgCardInput } from "../src/services/og";

const OUT = path.resolve(__dirname, "..", "..", "web", "public");

const CARDS: Array<{ file: string; input: OgCardInput }> = [
  {
    file: "og.png",
    input: {
      eyebrow: "Full-stack engineer & team lead",
      title: "Yehuda Briskman",
      meta: "yehudabriskman.com",
    },
  },
  {
    file: "og-blog.png",
    input: { eyebrow: "Writing", title: "Notes", meta: "yehudabriskman.com/blog" },
  },
  {
    file: "og-projects.png",
    input: { eyebrow: "Work", title: "Projects", meta: "yehudabriskman.com/projects" },
  },
];

if (!fs.existsSync(OUT)) throw new Error(`public/ not found at ${OUT}`);

for (const card of CARDS) {
  const png = renderCardPng(card.input);
  fs.writeFileSync(path.join(OUT, card.file), png);
  console.log(`${card.file.padEnd(18)} ${(png.length / 1024).toFixed(1)} KB`);
}
