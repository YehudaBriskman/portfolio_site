# Notes for agents and contributors

- **Admin UI** (anything under `/admin`, `web/src/components/admin`, `web/src/pages/Admin*`): read [`docs/admin-design-guide.md`](docs/admin-design-guide.md) first. It holds the importance-scoring method, the phone budget numbers, the component catalogue, the icon vocabulary and the PR checklist. Add a catalogue row when you add a component under `web/src/components/ui` (a guard test fails otherwise).
- **Motion**: [`docs/motion-contract.md`](docs/motion-contract.md).
- Contribution rules and the check commands: [`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md). Run `make check` before a PR; run vitest from `web/` or `backend/`, never from the repo root.
- Write the failing test first.
