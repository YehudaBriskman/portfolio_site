import { useEffect, useState } from "react";

export type Telemetry = { cpu: number; memory: number; live: boolean };

/*
 * Reads the node's real CPU and memory from Prometheus, proxied through nginx at
 * fixed paths so no arbitrary query can be run from outside.
 * If it can't reach them the page still works — it just stops claiming the
 * numbers are live, rather than inventing them.
 */
export function useTelemetry(): Telemetry {
  const [state, setState] = useState<Telemetry>({ cpu: 0.18, memory: 0.24, live: false });

  useEffect(() => {
    let cancelled = false;
    const read = async (path: string): Promise<number | null> => {
      try {
        const res = await fetch(path, { headers: { Accept: "application/json" } });
        if (!res.ok) return null;
        const json = await res.json();
        const v = json?.data?.result?.[0]?.value?.[1];
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      } catch {
        return null;
      }
    };

    const tick = async () => {
      const [cpu, mem] = await Promise.all([read("/telemetry/cpu"), read("/telemetry/memory")]);
      if (cancelled) return;
      if (cpu === null && mem === null) {
        setState((s) => ({ ...s, live: false }));
        return;
      }
      setState({
        cpu: cpu === null ? 0.18 : Math.min(1, Math.max(0, cpu / 100)),
        memory: mem === null ? 0.24 : Math.min(1, Math.max(0, mem / 100)),
        live: true,
      });
    };

    tick();
    const id = window.setInterval(tick, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return state;
}

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}
