import { decisions, infrastructure, namespaces, totalPods } from "@/data/infrastructure";
import { useTelemetry } from "@/hooks/useTelemetry";

function Gauge({ label, value, live }: { label: string; value: number; live: boolean }) {
  return (
    <div>
      <div className="mono flex items-baseline justify-between text-xs text-clay">
        <span className="uppercase tracking-[0.22em]">{label}</span>
        <span className="text-bone tabular-nums">{(value * 100).toFixed(1)}%</span>
      </div>
      <div className="mt-3 h-px w-full bg-edge">
        <div
          className={`h-px transition-[width] duration-1000 ease-out ${live ? "bg-sodium" : "bg-clay"}`}
          style={{ width: `${Math.max(2, value * 100)}%` }}
        />
      </div>
    </div>
  );
}

export default function Signal() {
  const { cpu, memory, live } = useTelemetry();

  return (
    <section id="signal" className="relative mx-auto max-w-6xl px-6 py-28 sm:py-36">
      <p className="eyebrow">
        {totalPods} pods — {namespaces.length} namespaces — one node
      </p>
      <h2 className="display-tight mt-5 text-section">What&rsquo;s running</h2>

      <div className="mt-14 grid gap-14 lg:grid-cols-[1fr_1.15fr]">
        <div>
          <div className="space-y-8">
            <Gauge label="CPU" value={cpu} live={live} />
            <Gauge label="Memory" value={memory} live={live} />
          </div>
          <p className="mono mt-6 text-[0.6875rem] leading-relaxed text-clay/70">
            {live
              ? "Read from Prometheus on the node, refreshed every 15 seconds."
              : "Live readings unavailable right now — these are last-known figures, not live."}
          </p>

          <dl className="mt-12 space-y-4 border-t border-edge pt-8">
            {[
              ["Orchestrator", infrastructure.orchestrator],
              ["Operating system", infrastructure.os],
              ["Certificates", infrastructure.tls],
              ["Private network", infrastructure.mesh],
              ["Monthly cost", infrastructure.cost],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-6">
                <dt className="text-sm text-clay">{k}</dt>
                <dd className="mono text-right text-xs text-bone">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div>
          <ul className="divide-y divide-edge border-y border-edge">
            {namespaces.map((ns) => (
              <li key={ns.name} className="flex items-baseline gap-5 py-4">
                <span
                  className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                    ns.tone === "sodium" ? "bg-sodium" : ns.tone === "screen" ? "bg-screen" : "bg-clay"
                  }`}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="mono text-sm text-bone">{ns.name}</p>
                  <p className="mt-1 text-sm leading-relaxed text-clay">{ns.purpose}</p>
                </div>
                <span className="mono shrink-0 text-xs tabular-nums text-clay/70">
                  {ns.pods} {ns.pods === 1 ? "pod" : "pods"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-24 grid gap-10 md:grid-cols-3">
        {decisions.map((d) => (
          <div key={d.claim}>
            <div className="rule mb-6 w-10 bg-sodium" />
            <h3 className="display-tight text-lg leading-snug text-bone">{d.claim}</h3>
            <p className="mt-4 text-sm leading-relaxed text-clay">{d.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
