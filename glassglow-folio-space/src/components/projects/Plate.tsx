import { Fragment } from "react";

/* A console tool does not photograph well, and repeating its tagline beside the
   tagline is not a visual. This shows what the thing actually does: a discovered
   table, which is Bothy's whole argument. Illustrative, not live — so it is
   marked as a sample rather than dressed up as real output. */
const DISCOVERED: [string, string, string][] = [
  ["traefik", ":443", "edge"],
  ["grafana", ":3000", "/grafana"],
  ["prometheus", ":9090", "/metrics"],
  ["postgres", ":5432", "—"],
];

export default function Plate({ className = "" }: { className?: string }) {
  return (
    <div className={`card-shot relative flex flex-col justify-between border border-edge p-5 sm:p-7 ${className}`}>
      <span className="mono self-end text-xs uppercase tracking-[0.2em] text-clay">sample</span>

      <div className="mono min-w-0 text-[0.75rem] leading-relaxed sm:text-[0.8125rem]">
        <div className="text-sodium">$ bothy ls</div>
        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 text-clay sm:gap-x-5">
          <span>SERVICE</span>
          <span>PORT</span>
          <span>ROUTE</span>
        </div>
        <div className="mt-1 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-1 text-bone/85 sm:gap-x-5">
          {DISCOVERED.map(([svc, port, route]) => (
            <Fragment key={svc}>
              <span>{svc}</span>
              <span className="tabular-nums text-clay">{port}</span>
              <span className="text-clay">{route}</span>
            </Fragment>
          ))}
        </div>
      </div>

      <p className="text-[0.8125rem] leading-snug text-bone/70">
        Nothing above was configured. It was found by asking Docker.
      </p>
    </div>
  );
}
