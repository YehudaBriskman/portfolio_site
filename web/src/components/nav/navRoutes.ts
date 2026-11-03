/*
 * The four rooms the site keeps, which are the whole of what the bar takes
 * you to.
 *
 * What this file used to be
 * -------------------------
 * `navIndex.ts`, and most of it was an index generated from `data/projects.ts`
 * — every project, the notes shelf and the inquiry plate, eight items with the
 * one you were standing on marked. That reasoning is written up where it was
 * reversed (see the head of `Nav.tsx`); what matters here is that the
 * generation is gone, so the chrome no longer imports the collection at all.
 * A bar that lists four fixed rooms has no table to drift from, which is why
 * a hand-written array is the right shape now and was the wrong one then.
 *
 * Home, Journey, Work, Blogs — and why in that order (#222)
 * --------------------------------------------------------
 * The owner's words and the owner's order. It reads as a person before it
 * reads as a catalogue: who this is (Home), how he got here (Journey), what he
 * has made (Work), what he writes (Blogs). The account comes before the
 * evidence, which is the order a stranger asks the questions in, and the two
 * rooms that are lists sit together at the end of the bar.
 *
 * The labels are single words, and the bar no longer says "All". "All work"
 * and "All notes" were there to keep the room apart from the home page's
 * `<h2>Work</h2>` and `<h2>Notes</h2>`, which show four of each. That is now
 * carried by the room rather than the bar: each room opens on its own name as
 * its eyebrow, the document title and the route announcer say the same word,
 * and the home sections end in an onward link to the whole set. The bar
 * reading as four plain nouns, the same size and weight, is worth more than a
 * qualifier on two of them that only the home page needed.
 *
 * "Journey" is the page at `/story` (#46): a chaptered account of the work
 * along the other axis — the collection says what exists, this says how it
 * got there. It is still not "About" and not "CV": it names no employer, and
 * a label promising a résumé would be a label for a page that does not exist.
 *
 * "Blogs" is the page at `/blog`. The posts inside it are still called notes
 * where the prose talks about them one at a time; the room's name is Blogs.
 *
 * "Home" is a word rather than a monogram. "Y.B." rendered above a first
 * screen that sets the full name in display type was a second, worse answer to
 * a question the page had already answered, and a monogram is the one thing in
 * a chrome that cannot say where it goes.
 *
 * The routes did not move. `/story`, `/projects` and `/blog` are addresses
 * that have been shared, so renaming the rooms changes only the words.
 *
 * Hebrew
 * ------
 * Each label carries its Hebrew alongside it, in the same order: בית,
 * מסלול מקצועי, פרויקטים, בלוג. The owner's review of #287 found the first
 * choice (המסע, עבודות, בלוגים) too casual for a senior engineer's site:
 * המסע reads as a travel diary, עבודות as school assignments, and בלוגים is a
 * plural for what is one blog. מסלול מקצועי is the term a Hebrew CV uses for
 * a career path; פרויקטים is what the work is; בלוג is the plain loanword.
 * docs/hebrew/strings.md lists the alternatives. The Hebrew locale
 * is listed and disabled (see `locale.ts`), so these are on screen only once
 * it is switched on — they live here so that the switch is one line.
 */
import type { LocaleCode } from "./locale";

export type NavRoute = { to: string; label: Record<LocaleCode, string> };

export const NAV_ROUTES: readonly NavRoute[] = [
  { to: "/", label: { en: "Home", he: "בית" } },
  { to: "/story", label: { en: "Journey", he: "מסלול מקצועי" } },
  { to: "/projects", label: { en: "Work", he: "פרויקטים" } },
  { to: "/blog", label: { en: "Blogs", he: "בלוג" } },
];
