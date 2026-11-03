/*
 * Fenced blocks, framed (#249).
 *
 * A rehype plugin that runs before the highlighter. The highlighter replaces
 * each `<pre>` with its own, and the fence's language goes with it (an
 * unknown language comes back as "text"), so the language is recorded on a
 * wrapper the highlighter never touches:
 *
 *   <figure data-code="ts"><pre>…</pre></figure>
 *
 * and the renderer's `figure` override draws the label and the copy button
 * from it. Markdown has no other way to make a `<figure>`, so the override
 * sees only these.
 *
 * A fence in `svg` is a diagram, not code: its source goes on the wrapper as
 * `data-svg` and the `<pre>` is removed, so the highlighter never sees it and
 * the override draws it through `svgSafe` instead.
 */

type HastNode = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

const LANG = /^[a-z0-9+#.-]{1,24}$/i;

function textOf(node: HastNode): string {
  if (node.type === "text") return node.value ?? "";
  return (node.children ?? []).map(textOf).join("");
}

function langOf(pre: HastNode): string {
  const code = pre.children?.find((c) => c.type === "element" && c.tagName === "code");
  const cls = code?.properties?.className;
  const list = Array.isArray(cls) ? cls : typeof cls === "string" ? cls.split(/\s+/) : [];
  for (const c of list) {
    const m = /^language-(.+)$/.exec(String(c));
    if (m && LANG.test(m[1])) return m[1].toLowerCase();
  }
  return "";
}

export function rehypeCodeFrames() {
  return (tree: HastNode) => {
    const walk = (node: HastNode) => {
      if (!node.children) return;
      node.children = node.children.map((child) => {
        if (child.type === "element" && child.tagName === "pre") {
          const lang = langOf(child);
          if (lang === "svg") {
            return { type: "element", tagName: "figure", properties: { dataSvg: textOf(child) }, children: [] };
          }
          return { type: "element", tagName: "figure", properties: { dataCode: lang || "none" }, children: [child] };
        }
        walk(child);
        return child;
      });
    };
    walk(tree);
  };
}
