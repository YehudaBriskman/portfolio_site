import { Suspense, lazy } from "react";
import { infrastructure, totalPods } from "@/data/infrastructure";
import { usePrefersReducedMotion, useTelemetry } from "@/hooks/useTelemetry";

const ClusterScene = lazy(() => import("./scene/ClusterScene"));

export default function Hero() {
  const reduced = usePrefersReducedMotion();
  const { cpu, live } = useTelemetry();

  return (
    <section id="hero" className="relative min-h-[100svh] w-full overflow-hidden">
      <div className="absolute inset-0" aria-hidden="true">
        <Suspense fallback={null}>
          <ClusterScene load={cpu} reduced={reduced} />
        </Suspense>
      </div>
      {/* Keeps type legible over the scene without flattening it to a scrim. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-bitumen/85 via-bitumen/25 to-bitumen" />

      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-between px-6 pb-10 pt-28">
        <p className="eyebrow animate-fade-up">
          Yehuda Briskman — Full-stack engineer &amp; team lead — Tel Aviv
        </p>

        <div className="max-w-4xl">
          <h1 className="display text-hero animate-fade-up" style={{ animationDelay: "80ms" }}>
            Down to the
            <br />
            <span className="text-sodium">machine.</span>
          </h1>
          <p
            className="mt-8 max-w-xl text-base leading-relaxed text-clay animate-fade-up sm:text-lg"
            style={{ animationDelay: "180ms" }}
          >
            This page is served from a Kubernetes cluster I provisioned — one ARM node in
            Jerusalem, with the TLS, single sign-on and CI configured by hand. {totalPods} pods are
            running behind it as you read this.
          </p>
        </div>

        <div
          className="flex flex-wrap items-end justify-between gap-6 animate-fade-up"
          style={{ animationDelay: "280ms" }}
        >
          <dl className="mono flex flex-wrap gap-x-8 gap-y-3 text-xs text-clay">
            {[
              ["region", infrastructure.region],
              ["shape", infrastructure.shape],
              ["arch", infrastructure.arch],
              ["cost", infrastructure.cost],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[0.625rem] uppercase tracking-[0.22em] text-clay/60">{k}</dt>
                <dd className="mt-1 text-bone">{v}</dd>
              </div>
            ))}
          </dl>
          <a
            href="#signal"
            className="mono group flex items-center gap-3 text-xs uppercase tracking-[0.22em] text-clay transition-colors hover:text-sodium"
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${live ? "bg-sodium animate-pulse-soft" : "bg-clay/50"}`}
            />
            {live ? "Live from the node" : "See the machine"}
          </a>
        </div>
      </div>
    </section>
  );
}
