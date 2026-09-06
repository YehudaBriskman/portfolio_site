/*
 * Facts about the machine serving this page. Every value here was read off the
 * running system, not estimated. If the cluster changes, change these.
 */
export const infrastructure = {
  region: "il-jerusalem-1",
  regionLabel: "Israel Central · Jerusalem",
  shape: "VM.Standard.A1.Flex",
  arch: "arm64 · Ampere Altra",
  ocpu: 2,
  memoryGb: 12,
  diskGb: 100,
  os: "Ubuntu 24.04 LTS",
  kernel: "6.17.0-1020-oracle",
  orchestrator: "k3s v1.36.4",
  tls: "Let's Encrypt wildcard, DNS-01",
  mesh: "Tailscale (WireGuard)",
  cost: "$0 / month",
} as const;

/* Namespaces actually running on the node, with what each one is for. */
export const namespaces = [
  { name: "prod",         purpose: "This site and its contact API",      pods: 2, tone: "sodium" },
  { name: "monitoring",   purpose: "Prometheus, Grafana, Alertmanager",  pods: 6, tone: "screen" },
  { name: "forgejo",      purpose: "Git hosting and arm64 CI",           pods: 2, tone: "screen" },
  { name: "auth",         purpose: "GitHub SSO for every admin surface", pods: 1, tone: "sodium" },
  { name: "cert-manager", purpose: "Certificate issuance and renewal",   pods: 3, tone: "screen" },
  { name: "obsidian",     purpose: "CouchDB for note sync",              pods: 1, tone: "screen" },
  { name: "kube-system",  purpose: "Ingress, DNS, storage, metrics",     pods: 5, tone: "clay" },
] as const;

export const totalPods = namespaces.reduce((n, x) => n + x.pods, 0);

/* Decisions worth defending in an interview, not a feature list. */
export const decisions = [
  {
    claim: "Tailnet, not passwords, for anything administrative",
    detail:
      "Git hosting and the note database resolve to a private mesh address and are rejected at the proxy for every other source. Reaching them requires being on the network, not guessing a credential.",
  },
  {
    claim: "SSO where a browser is involved, network isolation where it isn't",
    detail:
      "Grafana sits behind GitHub OAuth restricted to one account. Git and database sync can't complete an OAuth redirect, so those get network restriction instead. Matching the control to the client matters more than applying one everywhere.",
  },
  {
    claim: "The whole tenancy is code",
    detail:
      "Network, instance, cloud-init and every workload live in a repository. The provider halved this tier's CPU allowance without notice; rebuilding is one command rather than an afternoon of clicking.",
  },
] as const;
