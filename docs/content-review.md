# Content review: WindoM and Bothy notes

Drafts for the owner to review before anything reaches the live site. Nothing in
this change writes to a deployed database. The drafts live in `backend/content/`.
`backend/scripts/import-content.mjs` loads them through the admin API, and it
writes nothing unless it is run with `--apply`.

Every fact below comes from public material only: the WindoM and Bothy
repositories on GitHub (README, CHANGELOG, `docs/guide/`, releases, tags and
merged pull requests). Nothing comes from private notes, machine configuration
or private repositories.

## How to load it, after review

```sh
# 1. See what would change. This only reads.
CONTENT_API_BASE=https://<admin origin> CONTENT_ADMIN_TOKEN=... \
  node backend/scripts/import-content.mjs

# 2. Write it.
CONTENT_API_BASE=https://<admin origin> CONTENT_ADMIN_TOKEN=... \
  node backend/scripts/import-content.mjs --apply
```

- **Dry run by default.** It prints a field-by-field diff, with changed body lines.
- **It never deletes.** A post on the server with no draft here (today that is
  `every-check-must-be-able-to-fail`) is listed and left alone.
- **Idempotent.** A second `--apply` reports `0 to write`.
- It writes through the admin `PUT` routes and sends the current `_rev`, so the
  API's validation and optimistic lock apply.
- `publishedAt` is stamped once by the API. For a post that is already
  published, the date is reported and never changed.
- The token is sent as `X-Admin-Proxy-Secret`. `CONTENT_ADMIN_COOKIE` can carry an
  SSO session cookie when the admin origin sits behind one. The script refuses
  plain `http` to anything except a loopback host.
- For local development, `make seed` (`seed-dev-content.mjs`) now writes these
  drafts as well. `--drafts-only` leaves out the fixture posts.

Verified locally against the Compose stack, with a store put into today's live
shape (placeholder WindoM area, one post): the dry run showed 17 writes, `--apply`
wrote them, and a second dry run showed `0 to write, 17 unchanged`.

## Areas

| Area | Title | Tagline | Cover | Docs opted in |
|---|---|---|---|---|
| `site` | Notes | Decisions, and what they cost | none | none |
| `windom` | WindoM | Every new tab becomes a dashboard | [`.github/assets/banner.webp`](https://raw.githubusercontent.com/YehudaBriskman/WindoM/main/.github/assets/banner.webp) (raw URL, checked 200 `image/webp`) | `README.md`, `CHANGELOG.md` |
| `bothy` | Bothy | A console for one machine that asks Docker what is running | [`docs/brand/social-preview.png`](https://raw.githubusercontent.com/YehudaBriskman/Bothy/main/docs/brand/social-preview.png) (raw URL, checked 200 `image/png`) | five pages of `docs/guide/` |

Changes to the live areas:

- **`windom`.** The title becomes "WindoM" and the placeholder description and
  tagline are replaced. The live cover pointed at a `/blob/` page, which returns
  HTML, under a path that no longer exists, so it was replaced with the README
  banner. The repo is now linked, and the links go to the store, the site and
  the repo.
- **`site`.** The description is broadened, because the shelf now sits next to
  project shelves, and it gets a tagline. Suggested only; drop the change from
  `areas/site.json` to keep the current text.
- **`bothy`.** New.

Ordering: `site` 10, `windom` 20, `bothy` 30.

## Notes

Featured: 1, 2 and 3 are set on the three engineering notes marked below. Words
counts the Markdown body.

| Title | Area | Date | Words | Featured | Sources |
|---|---|---|---|---|---|
| WindoM 1.0: the new tab as a dashboard | windom | 2026-03-19 | 217 |  | [CHANGELOG 1.0.0](https://github.com/YehudaBriskman/WindoM/blob/main/CHANGELOG.md), [tag v1.0.0](https://github.com/YehudaBriskman/WindoM/tree/v1.0.0) |
| WindoM 1.1: settings that follow you | windom | 2026-04-04 | 261 |  | [CHANGELOG 1.1.0](https://github.com/YehudaBriskman/WindoM/blob/main/CHANGELOG.md), [tag v1.1.0](https://github.com/YehudaBriskman/WindoM/tree/v1.1.0) |
| WindoM 1.3: weather without a key, and accounts you can recover (folds in 1.2.2) | windom | 2026-04-16 | 285 |  | [CHANGELOG 1.2.2, 1.3.3](https://github.com/YehudaBriskman/WindoM/blob/main/CHANGELOG.md), [release v1.3.3](https://github.com/YehudaBriskman/WindoM/releases/tag/v1.3.3) |
| WindoM 1.4: the Apps Hub, markets and a first-run guide (folds in 1.3.5) | windom | 2026-04-25 | 337 |  | [CHANGELOG 1.3.5, 1.4.0](https://github.com/YehudaBriskman/WindoM/blob/main/CHANGELOG.md), [tag v1.4.0](https://github.com/YehudaBriskman/WindoM/tree/v1.4.0) |
| WindoM 1.4.1: a release about not breaking | windom | 2026-10-20 | 319 |  | [CHANGELOG 1.4.1](https://github.com/YehudaBriskman/WindoM/blob/main/CHANGELOG.md), [PR #308](https://github.com/YehudaBriskman/WindoM/pull/308), [PR #309](https://github.com/YehudaBriskman/WindoM/pull/309) |
| WindoM 1.5: computed glass, and Gmail withdrawn (with 1.5.1) | windom | 2026-10-26 | 408 |  | [CHANGELOG 1.5.0, 1.5.1](https://github.com/YehudaBriskman/WindoM/blob/main/CHANGELOG.md), [release v1.5.0](https://github.com/YehudaBriskman/WindoM/releases/tag/v1.5.0), [release v1.5.1](https://github.com/YehudaBriskman/WindoM/releases/tag/v1.5.1) |
| The glass is computed, not decorated | windom | 2026-11-02 | 517 | 1 | [PR #349](https://github.com/YehudaBriskman/WindoM/pull/349), [CHANGELOG 1.5.0](https://github.com/YehudaBriskman/WindoM/blob/main/CHANGELOG.md), [README](https://github.com/YehudaBriskman/WindoM/blob/main/README.md) |
| A provider's 401 is not a signed-out user | windom | 2026-11-02 | 478 | 2 | [PR #362](https://github.com/YehudaBriskman/WindoM/pull/362), [CHANGELOG 1.5.1](https://github.com/YehudaBriskman/WindoM/blob/main/CHANGELOG.md) |
| Why the Gmail widget was withdrawn | windom | 2026-11-02 | 373 |  | [PR #329](https://github.com/YehudaBriskman/WindoM/pull/329), [CHANGELOG 1.5.0, 1.5.1](https://github.com/YehudaBriskman/WindoM/blob/main/CHANGELOG.md) |
| Bothy 2026.8: the first release | bothy | 2026-08-19 | 291 |  | [release v2026.8.1](https://github.com/YehudaBriskman/Bothy/releases/tag/v2026.8.1), [README](https://github.com/YehudaBriskman/Bothy/blob/main/README.md) |
| Bothy 2026.9: five services, a cluster console, and a guide | bothy | 2026-09-18 | 374 |  | [release v2026.9.0](https://github.com/YehudaBriskman/Bothy/releases/tag/v2026.9.0), [PR #176](https://github.com/YehudaBriskman/Bothy/pull/176), [PR #181](https://github.com/YehudaBriskman/Bothy/pull/181), [PR #117](https://github.com/YehudaBriskman/Bothy/pull/117) |
| Bothy asks Docker what is running | bothy | 2026-11-02 | 563 | 3 | [README](https://github.com/YehudaBriskman/Bothy/blob/main/README.md), [guide: Declaring a project](https://github.com/YehudaBriskman/Bothy/blob/main/docs/guide/projects.md), [PR #237](https://github.com/YehudaBriskman/Bothy/pull/237), [PR #245](https://github.com/YehudaBriskman/Bothy/pull/245) |
| Why Bothy has no shell in the browser | bothy | 2026-11-02 | 410 |  | [README](https://github.com/YehudaBriskman/Bothy/blob/main/README.md), [release v2026.8.1](https://github.com/YehudaBriskman/Bothy/releases/tag/v2026.8.1), [guide: Roles](https://github.com/YehudaBriskman/Bothy/blob/main/docs/guide/roles.md), [PR #125](https://github.com/YehudaBriskman/Bothy/pull/125), [PR #142](https://github.com/YehudaBriskman/Bothy/pull/142) |
| An updater that cannot choose the version | bothy | 2026-11-02 | 525 |  | [PR #181](https://github.com/YehudaBriskman/Bothy/pull/181), [PR #195](https://github.com/YehudaBriskman/Bothy/pull/195), [PR #200](https://github.com/YehudaBriskman/Bothy/pull/200), [PR #205](https://github.com/YehudaBriskman/Bothy/pull/205) |

Dates: a release note carries the GitHub release time where a release exists,
and the CHANGELOG date at 12:00 UTC where there is only a tag. The engineering
notes are dated 2026-11-02, the day before drafting, so none of them shows in
the future. Change any date in the file header before importing; the API keeps
whatever date a post is first published with.

WindoM tags with no note of their own: 1.2.2 is folded into the 1.3 note, 1.3.5
into 1.4, and 1.5.1 into 1.5 (same day). Bothy has two tagged releases, and both
have a note. The updater note says plainly that its work is on `main` and not
yet in a tagged release.

## Every claim with a number

| Claim | Note | Source |
|---|---|---|
| OAuth tokens encrypted with AES-GCM | WindoM 1.0 | CHANGELOG 1.0.0 |
| End-to-end suite of 50 assertions in 10 groups | WindoM 1.3 | CHANGELOG 1.3.3 |
| Six settings templates | WindoM 1.4 | CHANGELOG 1.4.0 ("6 curated presets") |
| Six integrations in the Apps Hub | WindoM 1.4 | CHANGELOG 1.4.0 (names them) |
| 25 radius expressions reduced to 5 tokens | WindoM 1.5, glass note | CHANGELOG 1.5.0, PR #349 |
| Spotify showed stale state for up to fifteen seconds | WindoM 1.5 | CHANGELOG 1.5.1 |
| Incidence capped at 65 degrees | glass note | CHANGELOG 1.5.0, PR #349 |
| 519 ms of script per panel open, now 11 ms | glass note | CHANGELOG 1.5.0 (519 ms), PR #349 (11 ms) |
| Backdrop samples 13 to 4, worst frame 100 ms to 33 ms | glass note | PR #349 |
| Dropped frames 24 to 23 with refraction off | glass note | PR #349 |
| Refresh budget of five per fifteen minutes | 401 note | CHANGELOG 1.5.1, PR #362 |
| 15 new tests | 401 note | PR #362 |
| Gmail polled every forty-five seconds | Gmail note | CHANGELOG 1.5.1 |
| Five generated credentials | Bothy 2026.8 | release v2026.8.1, README |
| Four roles | Bothy 2026.8, no-shell note | release v2026.8.1, README |
| Five themes | Bothy 2026.8 | release v2026.8.1 |
| About 600 assertions per PR install | Bothy 2026.8 | release v2026.8.1 ("~600 assertions") |
| Eight containers to five | Bothy 2026.9 | PR #176, README |
| About 470 duplicated lines removed | Bothy 2026.9 | PR #176 |
| 29 audited cluster actions | Bothy 2026.9 | PR #176, README |
| 15 days of history imported | Bothy 2026.9 | PR #176 |
| 12 settings sections | Bothy 2026.9 | PR #176 |
| A container appears within ten seconds | Docker note | README |
| Disk usage polled every two minutes | Docker note | PR #245 |
| Three container verbs | no-shell note | README |
| Last three snapshots kept per component | updater note | PR #195 |
| At most one automatic update per night | updater note | PR #200 |
| Ten-minute rollback timer | updater note | PR #205 |

The Gmail note gives no dollar figure for the assessment. The source PR quotes
a price range for a third-party service, and that range can change without the
repository changing with it.

## Deliberately left out

The descriptions here are generic on purpose, so this list repeats none of
what it leaves out.

- **Machine and network details.** Addresses, ports, host and node names,
  private-network specifics, user accounts and filesystem paths from the Bothy
  repository and its pull requests. Bothy is the owner's own development box,
  so its public material holds more of these than a product repo would.
- **Third-party project names.** Some Bothy material names other projects that
  run on the same machine, and a network named after one of them. None of those
  names appear in the notes, and the Bothy overview screenshot that shows them
  was not used as a cover.
- **Two top-level Bothy documents** (the README and the architecture document)
  are left out of the area's `docPaths` because they carry such names and machine details. Only `docs/guide/`
  pages are opted in. The area still links the repository itself. If those
  references are renamed upstream, the README can be added.
- **Security specifics.** The exact way a socket-proxy permission could expose
  container configuration, credential and placeholder-password incidents, the
  content of security scans, and any detail of how something could be attacked.
  The no-shell note describes the design and leaves out the attack paths.
- **Incident narratives.** A reliability incident is described by its fix
  (migrations moved out of startup), not by how long it lasted or what it
  affected. Production log excerpts from pull requests are not quoted.
- **Internal tooling and attribution.** Bot signatures, internal vault and
  billing remarks, and notes about the authoring tools' own configuration files.
- **Unverifiable or fast-rotting numbers.** Merged-PR totals, star counts and
  third-party prices. The area page already shows live repository facts.
- **Bothy's operational knowledge base and plans** (`docs/kb/`, `docs/plans/`).
  They are operational history, not product documentation. A test refuses any
  `docPaths` entry under `kb/`, `plans/` or `host/`.

## How this is held

`backend/scripts/content-files.test.ts`, run by `npm test` in `backend/`, checks
that:

- every area and note parses with the admin write schemas (`CollectionWrite`,
  `PostWrite`) and with the stored schemas (`CollectionSchema`, `PostSchema`);
- each file name matches its slug, and each note sits in an area that exists;
- the header's `readingMinutes` equals what the API computes;
- each note is 150 to 700 words and cites at least one public source;
- covers are raw file URLs, never `/blob/` pages;
- at most three notes are featured;
- no note contains an IPv4 address, a host:port, a bare port, a tailnet name,
  a credential-shaped string or a bot signature.

## Preview

Rendered locally from these drafts, with `node backend/scripts/seed-dev-content.mjs --drafts-only`:

- `docs/content-preview/blog.png`: `/blog`
- `docs/content-preview/blog-area-windom.png`: `/blog/area/windom`

The repository facts on the area page (stars, latest release) were fetched
live by the local API's sync job. They are not part of the drafts.
