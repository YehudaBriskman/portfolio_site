import { usePageCommitted } from "@/components/nav/pageCommit";
import Hero from "@/components/Hero";
import Work from "@/components/Work";
import Approach from "@/components/Approach";
import ContributionCity from "@/components/city/ContributionCity";
import DarkAct from "@/components/ground/DarkAct";
import Stack from "@/components/Stack";
import LatestNotes from "@/components/LatestNotes";
import Contact from "@/components/Contact";
import SiteFooter from "@/components/SiteFooter";
import { Fragment, type ReactNode } from "react";
import { DARK_SECTIONS, shownSections, type HomeSection } from "@/settings/schema";
import { useSiteSettings } from "@/settings/store";

/*
 * The home page: the hero, then the sections the settings name, in order.
 * Motion lives inside each section (`components/motion/Arrive`), not in a
 * wrapper here: a wrapping reveal pushed full-width sections past the right
 * edge until they fired (horizontal overflow) and would clip Approach's
 * pinned deck.
 */

/*
 * The sections after the hero, by the id the settings name them. Why
 * DEFAULT_SETTINGS has this order: the two dark acts (work, the year) are the
 * only sections whose subject is the work itself, so they alone leave the
 * paper, and the wall of text between them keeps them from reading as one act.
 * The year must not sit next to the pile or between the shelf and the plate:
 * the shelf follows the pinned beat (lateral travel after a held screen) and
 * the plate answers it. The schema enforces that the two dark acts never touch.
 * The shelf has no `layer-section`: it is full-bleed and rides the space the
 * section above opened.
 */
const SECTIONS: Record<HomeSection, () => ReactNode> = {
  work: () => (
    <DarkAct>
      <Work />
    </DarkAct>
  ),
  approach: () => (
    <div className="layer-section">
      <Approach />
    </div>
  ),
  city: () => (
    <DarkAct>
      <ContributionCity />
    </DarkAct>
  ),
  notes: () => (
    <div>
      <LatestNotes />
    </div>
  ),
  stack: () => (
    <div className="layer-section">
      <Stack />
    </div>
  ),
  contact: () => (
    <div className="layer-section">
      <Contact />
    </div>
  ),
};

export default function Index() {
  /* The skip link and bar live in `SiteChrome.tsx`, above the routes; this
     tells that chrome the page, and its dark acts, are in the document. */
  usePageCommitted();
  const shown = shownSections(useSiteSettings());

  return (
    <div className="relative min-h-screen">
      {/* No nav clearance here, unlike PageShell: the hero is a full-height
          section that positions its own first line under the island. */}
      <main id="content">
        {/* The hero is the person and nothing else, and it owns its own
            rhythm — it is the only full-height section on the page. It is
            held until a dark act slides over it, so it holds only when the
            first section after it is one (#254). */}
        <Hero pinnedBehindNextAct={DARK_SECTIONS.includes(shown[0])} />

        {shown.map((id) => (
          <Fragment key={id}>{SECTIONS[id]()}</Fragment>
        ))}
      </main>

      {/*
        The footer stands on its own ground, not on the last section.

        It used to be rendered inside <Contact>, so it inherited whichever
        colour that section's layer had risen to — a warm rust by the foot of
        the page. Every token in the footer was measured against the page
        ground and none of them had been measured against that, which is why
        the column headings and the admin link were the least legible text on
        the site.
      */}
      <SiteFooter />
    </div>
  );
}
