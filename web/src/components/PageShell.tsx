import type { ReactNode } from "react";
import { usePageCommitted } from "@/components/nav/pageCommit";
import SiteFooter from "@/components/SiteFooter";

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
 *
 * The chrome is not in here
 * -------------------------
 * The skip link and the bar used to be rendered by this shell, and by the home
 * page separately, which is why they unmounted on every navigation (#63). They
 * are in `SiteChrome.tsx` now, once, above the routes. What stays is what
 * genuinely differs per shell: whether the first section needs clearing under
 * the bar, and the footer.
 */
export default function PageShell({ children }: { children: ReactNode }) {
  /* Tells the chrome this page is now in the document — see `pageCommit.ts`
     for why the pathname alone cannot. */
  usePageCommitted();

  return (
    <div className="relative min-h-screen">
      {/* Nav clearance, once, for every page in this shell — rather than baked
          into every page's first section, which is how four pages ended up
          with four different values for it. The island is fixed, 50px tall
          and 18px down; 4rem here plus the section's own top rhythm clears
          68px at every width. */}
      <main id="content" className="pt-16 max-sm:pt-0">
        {children}
      </main>
      {/* Content pages had no footer at all; these are the pages people land on
          from a search, and they offered no way onward. */}
      <SiteFooter />
    </div>
  );
}
