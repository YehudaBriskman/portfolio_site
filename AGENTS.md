# Notes for agents and contributors

- **Admin UI** (anything under `/admin`, `web/src/components/admin`, `web/src/pages/Admin*`): read [`docs/admin-design-guide.md`](docs/admin-design-guide.md) first. It holds the importance-scoring method, the phone budget numbers, the component catalogue, the icon vocabulary and the PR checklist. Add a catalogue row when you add a component under `web/src/components/ui` (a guard test fails otherwise).
- **Public site on a phone** (home, blog, notes, projects, contact, help, anything a visitor sees): read [`docs/public-mobile-guide.md`](docs/public-mobile-guide.md). Rules R1-R21, the component catalogue and the real-device checklist. A guard test holds shrink-only allow-lists of the existing offenders: never add a line, remove one when you fix it. New public wording goes in the PR under `STRINGS FOR OWNER APPROVAL`.
- **Motion**: [`docs/motion-contract.md`](docs/motion-contract.md).
- Contribution rules and the check commands: [`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md). Run `make check` before a PR; run vitest from `web/` or `backend/`, never from the repo root.
- Write the failing test first.
