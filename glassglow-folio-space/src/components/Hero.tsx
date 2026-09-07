import { Suspense, lazy, useEffect, useState } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import ScenePoster from "@/components/scene/ScenePoster";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useHeroOnScreen, useSceneEligible } from "@/hooks/useSceneEligible";

const ClusterScene = lazy(() => import("./scene/ClusterScene"));

export default function Hero() {
  const reduced = usePrefersReducedMotion();
  const eligible = useSceneEligible();
  const onScreen = useHeroOnScreen();
  const [armed, setArmed] = useState(false);

  // Defer the import until the browser is idle so it never competes with fonts
  // and CSS during first paint.
  useEffect(() => {
    if (!eligible) return;
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    const id = w.requestIdleCallback
      ? w.requestIdleCallback(() => setArmed(true))
      : window.setTimeout(() => setArmed(true), 300);
    return () => window.clearTimeout(id as number);
  }, [eligible]);

  return (
    <section id="hero" className="relative min-h-[100svh] w-full overflow-hidden">
      <div className="absolute inset-0" aria-hidden="true">
        <ErrorBoundary fallback={<ScenePoster />}>
          {armed ? (
            <Suspense fallback={<ScenePoster />}>
              <ClusterScene reduced={reduced} active={onScreen} />
            </Suspense>
          ) : (
            <ScenePoster />
          )}
        </ErrorBoundary>
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-bitumen/85 via-bitumen/25 to-bitumen" />

      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-between px-6 pb-10 pt-28">
        <p className="eyebrow animate-fade-up">
          Yehuda Briskman — Full-stack engineer &amp; team lead — Tel Aviv
        </p>

        <div className="max-w-4xl">
          <h1 className="display text-hero animate-fade-up" style={{ animationDelay: "80ms" }}>
            Built to be
            <br />
            <span className="text-sodium">used.</span>
          </h1>
          {/* bone rather than clay: clay drops to 3.27:1 over a lit scene pixel. */}
          <p
            className="mt-8 max-w-xl text-base leading-relaxed text-bone/80 animate-fade-up sm:text-lg"
            style={{ animationDelay: "180ms" }}
          >
            I ship products end to end — a Chrome extension published in the Web Store, a
            self-hosted operations console, and the backends and release pipelines under both.
            Then I write the checks that prove they still work somewhere that isn&rsquo;t my laptop.
          </p>
        </div>

        <div
          className="flex flex-wrap items-end justify-between gap-6 animate-fade-up"
          style={{ animationDelay: "280ms" }}
        >
          <a
            href="https://windom.app"
            target="_blank"
            rel="noreferrer noopener"
            className="mono text-xs uppercase tracking-[0.22em] text-clay transition-colors hover:text-sodium"
          >
            windom.app ↗
          </a>
          <a
            href="#work"
            className="mono text-xs uppercase tracking-[0.22em] text-clay transition-colors hover:text-sodium"
          >
            See the work ↓
          </a>
        </div>
      </div>
    </section>
  );
}
