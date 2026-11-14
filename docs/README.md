# Documentation

The manual for [yehudabriskman.com](https://yehudabriskman.com)'s code. Start
with the manual; the rest are design records and audits kept for their
reasoning.

## Manual

| | |
|---|---|
| [Getting started and local development](manual/getting-started.md) | prerequisites, `make up`, running from source, the checks CI runs |
| [Admin and content guide](manual/admin.md) | signing in, every admin page, API tokens, content kept in the repo |
| [Media](manual/media.md) | the media library, kinds, storage, URLs, importing pictures |
| [English and Hebrew](manual/i18n.md) | `/he`, RTL, interface strings, translated and stale content, the glossary |
| [MCP](manual/mcp.md) | the remote MCP server and the local stdio one |
| [Sharing and Announce](sharing.md) | the visitor Share menu, share cards, the owner's Announce inbox, settings and rollback |
| [Newsletter](newsletter.md) | the mailing list: audience, double opt-in, campaigns and the sender, privacy, erasure and recovery, deliverability, the Israeli commercial-mail points, runbook |
| [Deploy and release](manual/deploy.md) | CI, preprod, release tags, rollouts and rollbacks |

Also: [mcp/README.md](../mcp/README.md) for the stdio server in full, and
[remote-mcp/README.md](remote-mcp/README.md) for the remote one.

## Design records and audits

| | |
|---|---|
| [Public mobile guide](public-mobile-guide.md) | how the public site behaves on a phone: rules R1-R20, component catalogue, real-device checklist |
| [Motion contract](motion-contract.md) | how and when things move, and what each animation costs |
| [Accessibility audit](accessibility/audit.md) | WCAG 2.2 AA conformance |
| [SEO audit](seo/audit.md) and [search terms](seo/keywords.md) | the site as a search engine reads it |
| [Bilingual content design](i18n/bilingual-content-design.md) | how content carries two languages |
| [Hebrew tech glossary](i18n/hebrew-tech-glossary.md) | the terminology policy |
| [English on the Hebrew site](i18n/english-on-hebrew-audit.md) | the audit behind the Hebrew pass |
| [Hebrew strings](hebrew/strings.md) | every Hebrew string the site shows |
| [Content review](content-review.md) | how drafts in `backend/content/` are reviewed and imported |
| [CI inventory and baseline](ci-optimization-plan.md) | what CI runs and what it measured |

## Screenshots

The other folders under `docs/` hold before-and-after screenshots attached to
the pull requests that changed each part of the site, named after the change
(`docs/hero-aurora/`, `docs/media-library/`, and so on). `docs/readme/` holds the
pictures the repository README uses.

Screenshots and images here are site content, not code: they are covered by
[LICENSE-CONTENT](../LICENSE-CONTENT), not the MIT licence.
