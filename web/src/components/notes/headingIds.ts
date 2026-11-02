/*
 * Ids on a note's headings (#225), so any heading can be linked to.
 *
 * GitHub's rule, which is what a reader would guess a fragment to be: lower
 * case, letters, marks and digits in any script kept (a Hebrew heading keeps
 * its Hebrew), spaces to hyphens, everything else dropped, and a repeat
 * numbered `-1`, `-2` in document order.
 */

export function headingSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

type HastNode = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

function textOf(node: HastNode): string {
  if (node.type === "text") return node.value ?? "";
  return (node.children ?? []).map(textOf).join("");
}

const ANCHORED = new Set(["h2", "h3", "h4"]);

/** A rehype plugin: an id on every h2–h4, unique within the document. */
export function rehypeHeadingIds() {
  return (tree: HastNode) => {
    const seen = new Map<string, number>();
    const walk = (node: HastNode) => {
      if (node.type === "element" && node.tagName && ANCHORED.has(node.tagName)) {
        const base = headingSlug(textOf(node)) || "section";
        const n = seen.get(base) ?? 0;
        seen.set(base, n + 1);
        node.properties = { ...node.properties, id: n === 0 ? base : `${base}-${n}` };
      }
      node.children?.forEach(walk);
    };
    walk(tree);
  };
}
