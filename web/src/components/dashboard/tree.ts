import type { ReactNode } from "react";

/** One item in a `Tree`: a branch when it has children, a link when it does not. */
export type TreeNode = {
  id: string;
  label: ReactNode;
  /** The plain name, for type-ahead. */
  text: string;
  /** A leaf's destination. */
  href?: string;
  icon?: ReactNode;
  /** Muted text after the label: a count, a date. */
  meta?: ReactNode;
  children?: TreeNode[];
};

/** The ids a reader can reach with the arrow keys, in reading order. */
export function visibleIds(nodes: TreeNode[], open: Set<string>): string[] {
  const out: string[] = [];
  const walk = (list: TreeNode[]) => {
    for (const n of list) {
      out.push(n.id);
      if (n.children?.length && open.has(n.id)) walk(n.children);
    }
  };
  walk(nodes);
  return out;
}
