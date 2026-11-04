---
{
  "slug": "oci-free-a-cluster-on-the-free-tier",
  "title": "A Kubernetes cluster on a free-tier ARM VM",
  "subtitle": "One Oracle Cloud Always Free VM, described in OpenTofu, running k3s, with the rules that keep it free",
  "excerpt": "oci-free is the infrastructure this site runs on: a single free-tier ARM VM created with OpenTofu and cloud-init, running k3s, with Traefik on the node, cert-manager for certificates and nightly backups.",
  "tags": ["infrastructure", "terraform", "kubernetes", "k3s"],
  "collection": "oci-free",
  "status": "published",
  "publishedAt": "2026-09-06T18:38:41Z",
  "readingMinutes": 2,
  "featured": null,
  "coverImage": null,
  "links": [
    { "label": "Source on GitHub", "url": "https://github.com/YehudaBriskman/oci-free" }
  ],
  "sources": [
    { "label": "The oci-free repository", "url": "https://github.com/YehudaBriskman/oci-free" }
  ]
}
---
A personal site does not need a managed Kubernetes service, but it is a good
place to run one's own cluster properly. oci-free is that cluster: a single
ARM VM on Oracle Cloud's Always Free tier, running k3s, with everything
needed to recreate it kept in one repository.

## What is in the repository

- **OpenTofu for the cloud side.** The VM, its network and its firewall
  rules are described in code, so the machine can be destroyed and created
  again from the repository rather than from memory.
- **cloud-init for the first boot.** The VM installs and configures itself
  when it is created, with nothing done by hand on the console.
- **k3s and its manifests.** The workloads, the site among them, are plain
  Kubernetes manifests and Helm values in the same repository.

## Choices that follow from the free tier

- **Traefik on the node, not a cloud load balancer.** k3s ships Traefik as
  its ingress controller. Running it on the node itself avoids a paid load
  balancer and keeps the whole path in the cluster's own configuration.
- **cert-manager for certificates**, renewed in the cluster without a
  manual step.
- **Nightly backups** of the content databases, as Kubernetes CronJobs. The
  manifest states their scope plainly: the copy lives on the same disk, so it
  protects against a bad migration, a dropped database or a wrong delete,
  not against losing the node. An offsite copy is tracked as separate work.

## The rules that keep it free

Two rules are written down because breaking either one costs money or the
machine.

- **Never upgrade the account to pay-as-you-go.** On the free tier, the
  billing wall is the safety net: a mistake that would cost money simply
  fails. Upgrading removes that net.
- **Keep the VM busy enough not to be reclaimed.** Idle free-tier VMs can be
  reclaimed, and of the measures the provider looks at, memory use is the
  one a small workload can realistically keep above the line. Everything
  else is sized around that.

Administrative interfaces in the cluster are not exposed to the internet
directly; they sit behind a GitHub sign-in.
