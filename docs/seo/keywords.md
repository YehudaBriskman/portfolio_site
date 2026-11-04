# Search terms

Issue: #308 · Date: 2026-11-04

These are the terms someone who is looking for the owner, or for the work, would type. For each one this page records:
- what a search engine returns for it today;
- where the site could truthfully use it in copy it already has.

**No copy has been changed here beyond titles and descriptions.** Everything under "Proposed" needs the owner's approval first.

Rules this page keeps:
- no keyword stuffing;
- no hidden text, no doorway pages and no `meta keywords`;
- the current employer is never named, nor anything that hints at it.

A term appears only where the page is actually about it.

## What the search engines see today (evidence)

Searched on 2026-11-04 with a general web search. These are snapshots, not rank tracking.

| Query | What came back | What it means |
|---|---|---|
| `"Yehuda Briskman"` | No result about the owner. Other Briskmans fill the page: a music producer (Yochi Briskman), a genealogist (Jeffrey Briskman), a rabbi, and the *Brisker* disambiguation pages. | The name is not indexed for this site yet. It shares a surname with established entities. The `Person` node (with its `alternateName` and `sameAs` to GitHub and LinkedIn) is how a search engine tells them apart. |
| `"יהודה בריסקמן"` | No result about the owner. Results are about Yehuda Ha-Ezrahi (born Brisker) and the Brisk yeshiva movement. | The Hebrew spelling has no competition from a same-named person, but it is pulled toward "Brisk". The Hebrew titles on /he (#313) are the only place it appears. |
| `"full stack developer" portfolio Israel React TypeScript` | Personal portfolio sites of Israeli developers (vercel.app and github.io pages), LinkedIn, and résumé hosts. | This is the crowd the role terms compete in. A personal name plus a role is winnable; a bare role is not, and is not worth chasing. |
| `מפתח Full Stack פורטפוליו אתר אישי` | English-language guides only. No Hebrew portfolio sites. | Hebrew searchers write the role in Latin letters ("Full Stack") at least as often as in Hebrew. |
| `"מפתח פולסטאק" OR "מפתח פול סטאק"` | Nothing relevant: the engine read it as "key" (מפתח) products. | The fully Hebrew spelling of the role is ambiguous to search engines. Pair it with the Latin form; don't use it alone. |

Sources:
- [Briskman (Wikipedia)](https://en.wikipedia.org/wiki/Briskman)
- [Yochi Briskman](https://religion.fandom.com/wiki/Yochi_Briskman)
- [Brisker (Wikipedia)](https://en.wikipedia.org/wiki/Brisker)
- [יהודה האזרחי (Hamichlol)](https://www.hamichlol.org.il/%D7%99%D7%94%D7%95%D7%93%D7%94_%D7%94%D7%90%D7%96%D7%A8%D7%97%D7%99)
- [Eran Karaso portfolio](https://erancat.github.io/portfolio-site)
- [Rony Bubnovsky portfolio](https://ronyportfolio.vercel.app)
- [4Geeks: full stack developer portfolio](https://4geeksacademy.com/full-stack-developer-portfolio)

The search tool has no volume data, so this ranks the terms by intent, not by count.

## The terms, and where they truthfully belong

| Term | Language | Intent | Already used | Truthful place it could also go |
|---|---|---|---|---|
| Yehuda Briskman | en | navigational: looking for him | title of every English page, `og:site_name`, `author`, JSON-LD `Person.name` | the home H1 (see proposal 1) |
| יהודה בריסקמן | he | navigational | /he titles, Hebrew `Person.description`, `alternateName` | the Hebrew home fact line (proposal 2) |
| yehuda.br | en | navigational: the handle | `alternateName` | nowhere visible yet. Only worth showing if it is the handle on a profile he links (proposal 4) |
| Briskman | en | navigational, ambiguous | `familyName`, `alternateName` | nowhere else; the full name carries it |
| full-stack engineer | en | role | home title and description, `jobTitle` | already where it belongs |
| technical team lead | en | role | home title, `jobTitle` | the story page's description, if the story covers that role (proposal 3) |
| frontend engineer / frontend engineering | en | role, topic | home description ("mostly frontend"), blog description | already where it belongs |
| מהנדס פול־סטאק / Full Stack | he | role | Hebrew home title, `jobTitle` (he) | the Hebrew home description should carry the Latin "Full Stack" beside it, because that is how Hebrew searchers type it (proposal 2) |
| ראש צוות טכני | he | role | Hebrew home title | already where it belongs |
| Tel Aviv / תל אביב | both | local | home description, `PostalAddress` | already where it belongs |
| React, TypeScript, Node.js … | en | skill | `knowsAbout` (from the projects' own tech), each project's "Built with" | already where it belongs. Listing them in a description would be stuffing |
| WindoM, Bothy (project names) | both | navigational, product | project titles, `SoftwareSourceCode.name` | already where it belongs |
| accessibility, WCAG 2.2, IS 5568 / תקן 5568 | both | topic | the accessibility statement's title and description | already where it belongs |
| MCP server, Claude | en | topic | /developers/mcp title and description | already where it belongs |

## Applied in #308 (titles and descriptions only)

- Every page has its own title, built from one template capped at 60 characters, and its own description (#315).
- The Hebrew name is in the /he titles and the Hebrew home title, with the Latin beside it on the home page (#313).
- A Hebrew page whose item has no Hebrew is `noindex` (#304, #318), so the English title is not indexed twice.

## Proposed, needing the owner's approval

1. **Put the name in the home H1.** Today the H1 is "PORTFOLIO" (the owner's choice, recorded in `web/src/components/Hero.tsx`). The name sits in the fact line under it. The H1 is the page's strongest on-page signal, and "portfolio" is the one word a navigational search for the name never contains. Two options, both fully visible:
   - (a) wrap the fact line "Yehuda Briskman — full-stack, mostly frontend" into the heading as a second line of the H1;
   - (b) keep the H1 as it is and make the fact line an `h2`.

   (a) is the stronger signal. Do not keep "PORTFOLIO" visible while giving the heading a different hidden or `aria-label` name: that is hidden text, and it also breaks WCAG 2.5.3, Label in Name.
2. **Hebrew home description:** write "Full Stack" in Latin letters next to מהנדס פול־סטאק. Hebrew searchers type the Latin form, and the Hebrew-only spelling reads to engines as "key" (מפתח). Same meaning, no new claim.
3. **Story page description:** name the roles the story actually covers (for example "full-stack engineer and technical team lead"). Today it describes the timeline but not the person. Former employers may appear only if the story already names them; the current one never.
4. **Profile links:** the `sameAs` list is built from the site's own profile links (GitHub, LinkedIn). Adding any other profile the owner keeps under his name (for example a Hebrew-language profile, or one under the handle `yehuda.br`) to the site's profiles would give the entity more corroboration. That is the owner's call; nothing is added without it.
5. **Translate the hub-adjacent items first.** Under #304, each note or project published in Hebrew adds an indexed Hebrew page that carries the Hebrew name. The seeded projects (WindoM, Bothy) would add the most, because their pages link everything else.
