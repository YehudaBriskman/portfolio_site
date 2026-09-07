import type { ReactNode } from "react";
import Nav from "@/components/Nav";
import Atmosphere from "@/components/Atmosphere";
import { useScrollProgress } from "@/hooks/useScrollProgress";

/* Blog pages sit in the same landscape as the home page rather than on a plain
   background — otherwise leaving the index feels like leaving the site. */
export default function PageShell({ children }: { children: ReactNode }) {
  useScrollProgress();
  return (
    <div className="grain relative min-h-screen">
      <a href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:bg-sodium focus:px-4 focus:py-2 focus:text-bitumen">
        Skip to content
      </a>
      <Atmosphere />
      <Nav />
      <main id="content">{children}</main>
    </div>
  );
}
