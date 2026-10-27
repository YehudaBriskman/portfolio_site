import { scrollToAnchor } from "@/lib/scrollToAnchor";
import type { ReactNode } from "react";
import Nav from "@/components/Nav";
import SiteFooter from "@/components/SiteFooter";
import { useScrollProgress } from "@/hooks/useScrollProgress";

/*
 * The page frame, and the spacing rule the whole site follows.
 *
 * Blog and project pages sit in the same landscape as the home page rather
 * than on a plain background — otherwise leaving the index feels like leaving
 * the site.
 *
 * One rhythm, four steps
 * ----------------------
 * `.wrap` / `.wrap-wide` own the horizontal measure and `.section-y` owns the
 * space between sections (both in index.css). Everything *inside* a section
 * uses these four and invents nothing:
 *
 *   mt-3            bind       a label, rule or eyebrow to the thing it names
 *   mt-6            within     a heading to its copy, a paragraph to the next
 *   mt-12           block      one block of content to the next
 *   mt-section-sm   group      a self-contained group to the next
 *
 * A section head is display type, so it takes the step above its own rank:
 * `mt-12` down to its first block rather than `mt-6`.
 *
 * Item-to-item is never a margin on the child, it is a gap on the parent, and
 * there are three of those: `gap-3` for rows that already share a hairline or
 * a tap target, `gap-6` for cards and form fields, `gap-12` for the major
 * columns of a grid.
 *
 * The numbers are not the point. The point is that one distance always means
 * one relationship, so the structure of a page is legible before a word of it
 * is read. What this replaced — mt-2, mt-4, mt-5, mt-7, mt-9, mt-11, mt-14,
 * mt-16, mt-20, mt-24, mt-28 inside single sections — taught a reader nothing,
 * because none of it was answering the same question twice.
 */
export default function PageShell({ children }: { children: ReactNode }) {
  useScrollProgress();
  return (
    <div className="relative min-h-screen">
      <a href="#content"
        onClick={(e) => { if (scrollToAnchor("content")) e.preventDefault(); }}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:bg-bone focus:px-4 focus:py-2 focus:text-bitumen">
        Skip to content
      </a>
      <Nav />
      {/* Nav clearance, once, where the nav is rendered — rather than baked
          into every page's first section, which is how four pages ended up
          with four different values for it. The island is fixed, 50px tall
          and 18px down; 4rem here plus the section's own top rhythm clears
          68px at every width. */}
      <main id="content" className="pt-16">
        {children}
      </main>
      {/* Content pages had no footer at all; these are the pages people land on
          from a search, and they offered no way onward. */}
      <div className="footer-ground">
        <div className="wrap pb-section-sm">
          <SiteFooter />
        </div>
      </div>
    </div>
  );
}
