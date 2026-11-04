# Hebrew tech glossary and terminology policy

Status: **approved** (owner, #292: the contested calls accepted as written) · Issue: #294 (part of #292) · Date: 2026-11-03
Machine-readable twin: [`glossary.json`](../../web/src/i18n/glossary.json). Companions:
[audit](english-on-hebrew-audit.md) (#293), [design](bilingual-content-design.md) (#295).

This is the policy for how a technical term is written on the Hebrew site:
kept in Latin, written in Hebrew letters, translated, or chosen per audience.
Every term in it appears somewhere on the site: in the word tables, the seed
content, the server render, or the English that reaches `/he` (the audit).
Choices the owner already approved in the copy review (#290) are binding and
marked as such. Calls marked **owner** still need his ruling.

## 1. The four categories

| Cat. | Rule | Examples |
|---|---|---|
| **A: keep Latin** | Brand and product names, code identifiers, protocols, formats and acronyms, standards, key names, tag and slug values. Never written in Hebrew letters. A prefix letter attaches with a maqaf (`ב־GitHub`). A Latin run with internal punctuation is isolated. **A Latin term never stands alone as a Hebrew label**: `words.test.ts` requires Hebrew in every `he` value, so "RSS" alone fails, and the label is `פיד RSS`. | GitHub, Claude, Docker, React, PR, API, CI, MCP, RSS, JSON, OAuth, WCAG, Markdown, README, Enter |
| **B: transliterate** | Only when (a) practitioners write the loanword, (b) no Hebrew word is actually used, and (c) a general reader recognises it. Spoken slang (קומיט, מרג׳, דיפלוי, ריפו, פוש) is **not** promoted to public copy when a clear Hebrew word exists. | באג, פיד, קונטיינר, פריימוורק, פול־סטאק and פרונטאנד (owner-approved), קונטריביושן (owner's example) |
| **C: translate** | An established Hebrew word exists and Israeli UIs (Google, Wix, Microsoft's human-reviewed strings) or Hebrew Wikipedia use it. Machine-translation calques (התחייבות for commit, סניף for branch, בקשת משיכה, דחיפה) and Academy coinages the public rejected (מנשק, יישומון) are out. | מאגר, ענף, מיזוג, גרסה, תיעוד, רישיון, קוד פתוח, תוסף, דפדפן, טיוטה, פרסום, תצוגה מקדימה, שרת, בדיקות |
| **D: by context** | One term, three registers. **Public pages** describe the outcome in plain Hebrew and avoid jargon (push → עדכוני קוד, deploy → השקה, commit and PR are left out). **Admin** uses the plain working term. **Developer pages** (`/developers/mcp`) may use the practitioner term or the Latin acronym, introduced once as "Hebrew (English)" with the English isolated. | PR, commit, deploy, build, pipeline, dashboard, URL vs כתובת, tab |

How to decide a new term: if it is a name or code, it is A. If not, look for a
Hebrew word that Google's or Wix's Hebrew UI uses and a non-developer reads
correctly. If there is one, it is C. If developers only ever say the loanword
and a general reader knows it too, it is B. If the answer changes with who is
reading, it is D, and the entry says what to use where.

## 2. Writing conventions

**Maqaf with Latin and digits.** A one-letter prefix (ב ה ו כ ל מ ש) attaches to
a Latin word, a digit or a symbol with the Hebrew maqaf **U+05BE (־)**, with no
space: `ב־GitHub`, `ה־API`, `ו־Claude Desktop`, `מ־3`, `כ־12%`. Never use a
hyphen-minus or a dash. The same maqaf joins the approved compound `פול־סטאק`.
A transliteration the owner wrote as one word stays one word (`פרונטאנד`), so
its pair is `בקאנד`, not `בק־אנד`.

**Geresh and gershayim.** Use **U+05F3 (׳)** for transliterated sounds (ג׳ צ׳ ז׳)
and abbreviations (`דק׳ קריאה`). Use **U+05F4 (״)** inside Hebrew acronyms
(`ת״י 5568`, `דוא״ל`). Never an ASCII apostrophe or quote. Latin acronyms are
never spelled out in Hebrew letters (no `פי־אר`, no `איי־פי־איי`).

**Gender of loanwords.** An uninflected Latin term takes the gender of the
Hebrew noun it stands for, and is masculine by default: API (ממשק), MCP
(פרוטוקול, שרת), CI, PR, RSS (פיד), JSON, README, webhook and OAuth are all
masculine. "URL" is avoided in prose in favour of `כתובת`, which is feminine.
Transliterated nouns are masculine: קומיט, באג, פיד, קונטיינר, פריימוורק,
פרונטאנד, בקאנד, קונטריביושן.

**Plural of Latin terms.** A Latin token never takes a Hebrew suffix. Not
`PRים`, not `PR-ים`, not `APIים`. Show number with a numeral, an agreeing
adjective or a Hebrew head noun in construct:

- `3 PR פתוחים`
- `ממשקי API`
- `שרתי MCP`
- `אסימוני גישה`

Transliterated nouns inflect normally: קומיטים, באגים, פידים.

**Definite article.** The article attaches with a maqaf: `ה־PR`, `ה־API`. In
construct, the article goes on the last noun: `שרת ה־MCP`, `מאגר הקוד`.

**Bidi.** Use these tools in this order:

1. If a whole field is English, it is wrapped in `lang="en" dir="ltr"` by
   `inEnglish()` (`web/src/i18n/words.ts`).
2. A Latin run of several tokens that contains punctuation, arrows, colons or
   version numbers is isolated with **LRI U+2066 … PDI U+2069** (or a `<bdi>`
   in markup), as `statement.ts` already does for `mcp.desktop`. Examples:
   `Settings → Connectors`, `OAuth 2.1`, `mcp:read`, `v1.9.0`, a URL.
3. Put an **RLM U+200F** after a Latin run that is followed by neutral
   punctuation or a parenthesis (approved: `Model Context Protocol‏ (MCP)`).
   Also put one at the start of a string that opens with a Latin token
   (`‏claude.ai ו־…`).

Never put a control character inside a code identifier. **Attributes**
(`aria-label`, `title`, `alt`) cannot hold markup. A mixed Hebrew + Latin
attribute (the share buttons' `שיתוף "WindoM 1.5: …"`, see the audit) needs
LRI/PDI around the Latin, or the reading order heard and shown breaks.

**Quotes.** One straight `"` site-wide (approved in #290). Not `״` for
quotation, and not curly quotes.

## 3. The calls that matter most

These ten decisions shape the most copy, or are the ones most likely to be
challenged:

| # | Term | Cat. | Decision | Why |
|---|---|---|---|---|
| 1 | **pull request** | D (A in form) | `PR`, masculine, no suffix (`ה־PR`, `3 PR פתוחים`). Used only in admin and developer copy. Public copy says what happened. | Hebrew Wikipedia and Microsoft's *machine-translated* pages use בקשת משיכה, but practitioners write PR (internet-israel: "PR ענקיים"). The calque fails both audiences. The owner gave PR as his own example. |
| 2 | **contribution** (GitHub) | B | `קונטריביושן` / `קונטריביושנים` | The owner's example. In general Hebrew, `תרומה` reads first as a *donation*, which is the wrong frame next to a yearly count. **This changes** `city.contributions*` (today `תרומות`); owner to confirm. `תרומה` stays correct for "contributing to a project" in the open-source sense. |
| 3 | **commit** | D | Developers: `קומיט`/`קומיטים`. Public: leave it out (`עדכוני קוד`, `שינויים`). | Every Hebrew practitioner guide writes קומיט (ohshitgit/he, internet-israel). Microsoft's MT `התחייבות`/`ביצוע` is forbidden. |
| 4 | **push** | C/D | `עדכוני קוד` (binding, #290) | Owner-approved. `דחיפה` is a calque, and `פוש` is speech. |
| 5 | **repository** | C | `מאגר` (`ריפו` and `רפוזיטורי` forbidden in copy) | The sources disagree. Wikipedia's GitHub article uses מאגר, but its VCS article is titled רפוזיטורי, and developers say ריפו. Only מאגר reads correctly to everyone, and the site already uses it everywhere. |
| 6 | **deploy / ship** | D | Public: `השקה`/`להשיק`. Developers: `פריסה` **always with an object** (`פריסת האתר`). `דיפלוי` and `יעלה לאוויר` are forbidden. | The accessibility statement already uses `הפריסה` to mean the *page layout*, so a bare `פריסה` is ambiguous on this site. #290 replaced `יעלה לאוויר` with `יפורסם`. |
| 7 | **frontend / backend / full-stack** | B | `פרונטאנד` and `פול־סטאק` (binding). `בקאנד` **(owner)** | One word, to match the approved `פרונטאנד`. Alternatives: `בק־אנד` (hebrewglot), `צד שרת` (Drushim), `קצה אחורי` (Wikipedia). It is not used in any copy yet, so it needs a ruling before first use. |
| 8 | **note** | C | `רשימה`, never `רשומה` (binding) | `רשומה` is a *record* (a database row). The owner flagged it as the one confusion that must not recur. |
| 9 | **fork** | C | `פיצול` (forbidden: `מזלג`/`מזלגות`, `הסתעפות`) | Hebrew Wikipedia's GitHub and Fork articles use פיצול. `מזלגות` is a literal "cutlery" calque, already removed in #287. |
| 10 | **token / dashboard / tab** | C/D **(owner)** | `אסימון` (formal, already on the page; developers say `טוקן`). `לוח בקרה` (developers and product marketing often say `דשבורד`). `לשונית` (Chrome's Hebrew UI says `כרטיסייה`). | Each is defensible both ways, and the evidence found was weak. Pick once and enforce. WindoM's own Hebrew pitch ("every new tab becomes a dashboard") will force both the tab and the dashboard call. |

Also binding from #290, recorded here so they are enforced:

- docs → `תיעוד`
- featured → `מומלצות`
- developers → `למפתחים`
- retry → `ניסיון חוזר`
- channel log → `יומן פעילות`
- Specs → `במספרים`
- elsewhere → `ברשת`
- Blog → `בלוג`
- Work → `פרויקטים`
- buttons are nouns
- the reader is addressed in the plural

## 4. Evidence and its limits

The strongest evidence:

- Hebrew Wikipedia article titles, fetched through its API.
- Google's Hebrew Chrome help.
- Wix's Hebrew help center.
- Hebrew practitioner guides: ohshitgit/he, internet-israel.com, codebrain.
- Israeli job boards (Drushim, AllJobs), for role names.

Microsoft's he-il Learn pages are marked machine-translated in their own
metadata. They show what to **avoid** (בקשת משיכה, התחייבות, סניף), not what
Israelis write.

What could not be verified:

- The Academy of the Hebrew Language term database did not answer a fetched
  query. Its well-known computing coinages that the public rejected (מנשק,
  יישומון, סיבית) are documented by ynet.
- GitLab's Hebrew Crowdin project could not be reached.
- monday.com's Hebrew help center could not be reached.
- Israeli Facebook, Reddit and LinkedIn dev groups could not be reached.
- Microsoft's he-il Azure DevOps and Power BI pages came back in English.

Where a call rests on weak evidence, its rationale says so. Sources are listed
in §7.

## 5. Enforcement (items 1–3 implemented in #300)

`glossary.json` is the single source. It holds the categories, `allowLatin`
(the Latin terms the site may show on `/he`), `forbidden` (variant → preferred
form) and every term with its forms and contexts. It lives at
`web/src/i18n/glossary.json` (moved there by #300) so the web build and its
tests import it; `web/src/i18n/glossary.ts` is its one reader, and its
`lintHebrew` is what the tests run over the source and the admin will run as
advice. Variants the glossary forbids in one sense only (`כניסה`, `תג`,
`נושא`, `נתונים`…) are not failed on sight; they stay with review.

1. **`untranslated.test.ts` reads `allowLatin`.** Its hand-kept `LATIN` set (8
   entries today) is replaced by the glossary. A JSX string is allowed in Latin
   only if every Latin run in it is on the list.
2. **`words.test.ts` keeps requiring Hebrew** in every `he` value, and its
   `KEPT_IN_LATIN` stays empty. A Latin-only label is a policy violation
   (category A rule).
3. **A new `glossary.test.ts`** lints every `he` value in every word table and in
   `seo-words.ts`:
   - **forbidden variants** (`רשומה` in the sense of a note, `מזלגות`,
     `התחייבות`, `בקשת משיכה`, `PRים`, `יעלה לאוויר`, `דיפלוי`, `ריפו`, …),
     each failure naming the preferred form;
   - **a prefix letter glued to Latin without a maqaf** (`/(^|\s)[בהוכלמש][A-Za-z0-9]/`):
     `בGitHub` fails and `ב־GitHub` passes;
   - **a hyphen-minus or dash used as a maqaf** before Latin (`ב-GitHub`);
   - **a Hebrew suffix on a Latin token** (`/[A-Za-z]ים\b/`);
   - **Latin not on `allowLatin`** inside a Hebrew value, as a warning list that
     must be acknowledged in the test file, the same way PENDING works;
   - **an ASCII apostrophe used as a geresh** (`צ'`, `ג'`).
4. **Context rules (category D)** are checked by table location. Strings in
   `web/src/i18n/pages.ts` sections other than `mcp` count as public, so a PR,
   קומיט or פריסה with no object fails there.
5. **Content, not code: a lint in the admin** (design §7.7). The same rules run
   on Hebrew typed into a content field. They underline the problem and offer
   the fix, and never block a save.
6. **The audit crawl** (`web/scripts/i18n-audit/`) reads `allowLatin` to decide
   "keep Latin" when it classifies a finding.

Changing the glossary is a reviewed PR. It updates `glossary.json` and
regenerates the table in §6 from it (the table here was generated that way).

## 6. The glossary

All terms the site uses, by first appearance in the research. **Cat.** is the
category from §1. **where used** names word-table keys or files at `0b6714f`. A
blank cell means the term reaches `/he` only through content, not through a
word table. Links in the last column are the sources.

| Term | Cat. | Hebrew form | Plural / definite · gender | Where used | Rationale and sources |
|---|---|---|---|---|---|
| **pull request** (PR, merge request) | D | PR<br>*public:* Avoid the term; say what happened: 'שינוי שמוזג', 'עדכוני קוד'. If unavoidable: PR.<br>*admin:* PR<br>*developers:* First mention 'pull request‏ (PR)' with the English isolated, then PR. | PR (uninflected; plurality shown by number/adjective: 'שלושה PR פתוחים') · ה־PR · m | `backend/src/content/seed.ts (project facts, English only so far)` | Microsoft's machine-translated Hebrew docs and Hebrew Wikipedia use the calque בקשת משיכה; Hebrew-writing practitioners write PR in Latin ('PR ענקיים', 'שלחתי PR'). The calque is opaque to non-developers and unused by developers, so it fails both audiences. Practitioners also treat it as masculine (internet-israel: 'PR ענקיים').<br>**Not:** בקשת משיכה, בקשות משיכה, פול ריקווסט, PRים, PR-ים, פי־אר [1](https://learn.microsoft.com/he-il/training/modules/introduction-to-github/) [2](https://learn.microsoft.com/he-il/training/modules/introduction-to-github/3-components-of-github-flow) [3](https://he.wikipedia.org/wiki/GitHub) [4](https://internet-israel.com/category/%D7%9E%D7%93%D7%A8%D7%99%D7%9B%D7%99%D7%9D/git/) [5](https://hebrewglot.com/en/blog/hebrew-for-developers) |
| **merge** | C | מיזוג<br>*public:* מיזוג / למזג<br>*admin:* מיזוג<br>*developers:* מיזוג; git merge stays Latin in code | מיזוגים · המיזוג · m |  | Hebrew Wikipedia (גיט), Microsoft, codebrain and internet-israel ('למזג לפי שכבות') all use מיזוג/למזג; the slang מרג׳ appears only in informal guides.<br>**Not:** מרג׳, מרג', מרג'ים [1](https://he.wikipedia.org/wiki/%D7%92%D7%99%D7%98) [2](https://learn.microsoft.com/he-il/training/modules/introduction-to-github/3-components-of-github-flow) [3](https://internet-israel.com/category/%D7%9E%D7%93%D7%A8%D7%99%D7%9B%D7%99%D7%9D/git/) [4](https://www.codebrain.co.il/%D7%9E%D7%93%D7%A8%D7%99%D7%9A-%D7%9C-git-%D7%A0%D7%99%D7%94%D7%95%D7%9C-%D7%92%D7%A8%D7%A1%D7%90%D7%95%D7%AA-%D7%A7%D7%95%D7%93/) [5](https://ohshitgit.com/he) |
| **merge conflict** | C | התנגשות מיזוג<br>*admin:* In the settings/editor conflict messages prefer plain prose ('ההגדרות שונו במקום אחר') over the technical term. | התנגשויות מיזוג · התנגשות המיזוג · f | `admin-settings.conflict`, `note-editor (loadTheirs/keepMine)` | Admin copy already explains the conflict in prose; the term is only for developer docs.<br>**Not:** קונפליקט, סכסוך |
| **commit** | D | קומיט<br>*public:* Avoid; fold into עדכוני קוד / שינויים.<br>*admin:* קומיט<br>*developers:* קומיט; git commit in code | קומיטים · הקומיט · m |  | Microsoft's machine translation renders commit as התחייבות/ביצוע/מבצע (nonsense in context); Hebrew Wikipedia uses גרסה (revision). Practitioners write קומיט/קומיטים (ohshitgit/he, internet-israel 'מה זה קומיט'). The site's owner already chose to describe pushes as עדכוני קוד for public readers, so commit should stay out of public copy.<br>**Not:** התחייבות, התחייבויות, ביצוע, מחויבות, commitים [1](https://learn.microsoft.com/he-il/training/modules/introduction-to-github/3-components-of-github-flow) [2](https://he.wikipedia.org/wiki/%D7%92%D7%99%D7%98) [3](https://ohshitgit.com/he) [4](https://internet-israel.com/category/%D7%9E%D7%93%D7%A8%D7%99%D7%9B%D7%99%D7%9D/git/) [5](https://hebrewglot.com/en/blog/hebrew-for-developers) |
| **push** (pushed, pushes, last push) | C | עדכון קוד<br>*public:* עדכון קוד / עדכוני קוד<br>*admin:* עדכוני קוד<br>*developers:* עדכוני קוד; git push in code | עדכוני קוד · עדכון הקוד · m | `work.pushed`, `work.strip`, `work.stripEmpty`, `work.liveFailed` +6 | Owner-approved (push → עדכוני קוד). דחיפה is Microsoft/Wikipedia literalism; it was in mcp.toolsDo.list_activity before #290 and is now fixed.<br>**Not:** דחיפה, דחיפות, פוש, פושים [1](https://learn.microsoft.com/he-il/training/modules/introduction-to-github/3-components-of-github-flow) [2](https://he.wikipedia.org/wiki/%D7%92%D7%99%D7%98) |
| **repository** (repo) | C | מאגר<br>*public:* מאגר<br>*admin:* מאגר<br>*developers:* מאגר; 'repository' only in identifiers | מאגרים · המאגר · m | `work.repository`, `work.noDocs`, `work.docsFrom`, `work.releasesFrom` +5 | Evidence is split: Hebrew Wikipedia's GitHub article uses מאגר (repository), its version-control article title is רפוזיטורי, and practitioners say ריפו. מאגר is the only form a non-developer reads correctly and is already used site-wide.<br>**Not:** ריפו, רפוזיטורי, ריפוזיטורי, Repository in Hebrew prose [1](https://he.wikipedia.org/wiki/GitHub) [2](https://he.wikipedia.org/wiki/%D7%92%D7%99%D7%98) [3](https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=he) [4](https://ohshitgit.com/he) [5](https://www.codebrain.co.il/%D7%9E%D7%93%D7%A8%D7%99%D7%9A-%D7%9C-git-%D7%A0%D7%99%D7%94%D7%95%D7%9C-%D7%92%D7%A8%D7%A1%D7%90%D7%95%D7%AA-%D7%A7%D7%95%D7%93/) |
| **fork** (forks) | C | פיצול | פיצולים · הפיצול · m | `work.forks`, `history.forks` | Owner-approved (#287: מזלגות is cutlery). Hebrew Wikipedia's article is titled פיצול (פיתוח תוכנה) and its GitHub article writes 'יצירת פיצול (fork)'.<br>**Not:** מזלג, מזלגות, פורק, פורקים [1](https://he.wikipedia.org/wiki/GitHub) [2](https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=he) |
| **star** (stars, GitHub stars) | C | כוכב | כוכבים · הכוכבים · m | `work.stars`, `history.stars`, `work.liveFailed` | Literal matches GitHub's star icon; Hebrew Wikipedia paraphrases as 'סימון כמועדף', which loses the countable noun.<br>**Not:** סטארים, מועדפים (for GitHub stars) [1](https://he.wikipedia.org/wiki/GitHub) |
| **release** (releases, latest release, released) | C | גרסה<br>*public:* גרסה; 'Released 3' → 'גרסה 3' or 'פורסמה גרסה 3'<br>*admin:* גרסה<br>*developers:* גרסה | גרסאות · הגרסה · f | `work.releases`, `work.release`, `work.noReleases`, `work.released` +8 | Already the site's word and what Israeli users see in app stores. Microsoft MT alternates שחרור/מהדורה/הפצה for the same English word — a sign none is settled. Note the collision with settings 'Version 3' (also גרסה); context disambiguates.<br>**Not:** רליז, שחרור, מהדורה, הפצה [1](https://learn.microsoft.com/he-il/training/modules/introduction-to-github/3-components-of-github-flow) [2](https://hebrewglot.com/en/blog/hebrew-for-developers) |
| **version** | C | גרסה | גרסאות · הגרסה · f | `admin-settings.version`, `admin-settings.differences`, `note-editor.loadTheirs/keepMine` | Same word as release; fine. |
| **tag (git)** | D | תג<br>*developers:* Latin 'tag' or v1.2.3 in code; Hebrew תג only in prose | תגים · התג · m |  | Keeps note tags (תגית) and git tags apart.<br>**Not:** טאג, תגית (reserved for note tags) |
| **tag (note topic)** (tags, tagged) | C | תגית<br>*admin:* Tag values themselves are Latin slugs (lowercase, digits, dashes) and stay Latin: ci, docker, chrome-extension. | תגיות · התגית · f | `reader.tags`, `note-editor.tags`, `note-editor.tagsHelp`, `notes.tagged` +2 | Hebrew Wikipedia: Tag (metadata) → תגית. The editor enforces Latin slug values, so the value is category A while the word for it is C.<br>**Not:** תג, האשטאג, טאג [1](https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=he) |
| **branch** | C | ענף | ענפים · הענף · m |  | Hebrew Wikipedia (גיט), codebrain and internet-israel ('עבודה עם ענפים (branches)') use ענף; Microsoft MT mixes ענף with סניף (bank branch), a known MT error; ברנץ׳ is speech.<br>**Not:** סניף, סניפים, הסתעפות, ברנץ׳, בראנץ' [1](https://he.wikipedia.org/wiki/%D7%92%D7%99%D7%98) [2](https://internet-israel.com/category/%D7%9E%D7%93%D7%A8%D7%99%D7%9B%D7%99%D7%9D/git/) [3](https://www.codebrain.co.il/%D7%9E%D7%93%D7%A8%D7%99%D7%9A-%D7%9C-git-%D7%A0%D7%99%D7%94%D7%95%D7%9C-%D7%92%D7%A8%D7%A1%D7%90%D7%95%D7%AA-%D7%A7%D7%95%D7%93/) [4](https://learn.microsoft.com/he-il/training/modules/introduction-to-github/3-components-of-github-flow) [5](https://ohshitgit.com/he) |
| **issue** | D | Issues (GitHub feature) / בעיה<br>*public:* דיווח על בעיה<br>*developers:* GitHub Issues as a proper name in Latin | Issues / בעיות · ה־Issue · m |  | Hebrew Wikipedia keeps 'Issues' in Latin as a GitHub feature name; Microsoft MT renders it בעיות/נושאים inconsistently.<br>**Not:** סוגיה, נושא (for issue), אישיו [1](https://he.wikipedia.org/wiki/GitHub) [2](https://learn.microsoft.com/he-il/training/modules/introduction-to-github/) |
| **contribution** (contributions, contribution graph) | B | קונטריביושן<br>*public:* קונטריביושנים ב־GitHub (the year graph); in running prose for a general reader, 'פעילות ב־GitHub' is an acceptable paraphrase<br>*admin:* קונטריביושנים<br>*developers:* קונטריביושן | קונטריביושנים · הקונטריביושנים · m | `city.contributionsOver`, `city.tableCaption`, `city.contributions` | The owner's own example. In general Hebrew תרומה reads first as a donation (charity), which is exactly the wrong frame next to a number; practitioners say and write קונטריביושן for GitHub's count. תרומה stays correct for 'contributing to a project' in the open-source sense (Android's Hebrew site: 'תרומה לה'), but the graph counts events, not donations. Changes city.contributions* (today תרומות). Owner to confirm.<br>**Not:** תרומה (for a GitHub contribution), תרומות קוד, קונטריביושנס [1](https://source.android.com/source/?hl=he) |
| **clone** | C | שכפול<br>*developers:* git clone in code; שכפול המאגר in prose | שכפולים · השכפול · m |  | Not in the UI today; seed content mentions cloning in CI. codebrain writes 'פקודת Clone' — command stays Latin.<br>**Not:** קלון, שיבוט [1](https://www.codebrain.co.il/%D7%9E%D7%93%D7%A8%D7%99%D7%9A-%D7%9C-git-%D7%A0%D7%99%D7%94%D7%95%D7%9C-%D7%92%D7%A8%D7%A1%D7%90%D7%95%D7%AA-%D7%A7%D7%95%D7%93/) |
| **diff** (differences) | C | הבדלים<br>*developers:* diff (Latin) only for the tool/format | הבדלים · ההבדלים · m | `admin-settings.differences`, `note-editor.noChanges`, `note-editor.tooLong` | Hebrew Wikipedia keeps the tool as Diff; the UI only needs the plain noun.<br>**Not:** דיף [1](https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=he) |
| **open source** | C | קוד פתוח |  · m | `work STATE_WORDS['open source']` | Hebrew Wikipedia: Open-source software → קוד פתוח.<br>**Not:** אופן סורס, מקור פתוח [1](https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=he) [2](https://he.wikipedia.org/wiki/GitHub) |
| **source code** | C | קוד מקור |  · m | `projects.source` | Hebrew Wikipedia: Source code → קוד מקור. [1](https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=he) |
| **licence** (license) | C | רישיון | רישיונות · הרישיון · m | `history.licence` | Hebrew Wikipedia: רישיון תוכנה; full spelling with yod per Academy plene rules.<br>**Not:** רשיון (defective spelling), ליסנס [1](https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=he) |
| **GitHub** | A | GitHub | ב־GitHub / מ־GitHub · m | `work.onGitHub`, `work.liveFailed`, `work.releasesOnGitHub`, `log.leaves` +2 | Brand. Prefix letters attach with maqaf (U+05BE). GitHub has no Hebrew UI; its docs are not offered in Hebrew (could not verify the language picker by fetch — the fetched page did not include it).<br>**Not:** גיטהאב, גיטהב [1](https://he.wikipedia.org/wiki/GitHub) |
| **git** | A | Git | ב־Git · m |  | Hebrew Wikipedia's article is titled גיט and practitioners say גיט; in written UI keep the Latin name like every other tool name.<br>**Not:** גיט (in published copy) [1](https://he.wikipedia.org/wiki/%D7%92%D7%99%D7%98) |
| **deploy** (deployment, deployed, ship) | D | פריסה<br>*public:* Rephrase: 'השקה', 'גרסה חדשה עלתה', 'בתעשייה מאז' (owner's 'Shipping since'). Never bare פריסה — on this site it already means page layout.<br>*admin:* פריסה with an object: 'פריסת האתר'<br>*developers:* פריסה (with object); 'deploy' Latin in commands | פריסות · הפריסה · f | `accessibility-statement.inPlaceItems.3 (פריסה = layout!)`, `seed.ts project facts`, `approved: firstPublish יעלה לאוויר → יפורסם` | Hebrew Wikipedia: Software deployment → פריסת תוכנה; practitioners say דיפלוי (hebrewglot: 'לדפלוי' as slang). The owner rejected broadcast slang (באוויר, יעלה לאוויר). Collision: the a11y statement uses הפריסה for layout, so deploy must always carry its object.<br>**Not:** דיפלוי, דפלוי, לדפלי, הפצה, העלאה לאוויר, יעלה לאוויר [1](https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=he) [2](https://hebrewglot.com/en/blog/hebrew-for-developers) |
| **ship / shipping** | C | השקה / להשיק | השקות · ההשקה · f | `seo.siteSocial`, `seo.blogsDescription`, `approved: Shipping since 2021 → בתעשייה מאז 2021`, `specs: Shipping (years) → שנות ניסיון` | Owner-approved phrasings; ship is rendered by meaning, never literally.<br>**Not:** שיפינג, משלוח |
| **build** (build step, builds) | D | בנייה<br>*public:* Avoid; 'נבנה עם' for 'Built with'<br>*developers:* תהליך הבנייה; 'build' Latin in commands/script names | בניות · הבנייה · f | `projects.builtWith` | No standard Hebrew noun in practitioner writing (hebrewglot lists only לקמפל); בנייה is transparent.<br>**Not:** בילד, בילדים, קימפול (unless it is compilation) [1](https://hebrewglot.com/en/blog/hebrew-for-developers) |
| **CI** (continuous integration, CI/CD) | A | CI<br>*public:* First mention 'אינטגרציה רציפה (CI)' or avoid<br>*developers:* CI | ה־CI · m | `post tags 'ci'`, `seed.ts project facts` | Hebrew Wikipedia: אינטגרציה רציפה; practitioners write CI/CD in Latin.<br>**Not:** סי־איי, CIים [1](https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=he) [2](https://hebrewglot.com/en/blog/hebrew-for-developers) |
| **pipeline** | D | pipeline<br>*public:* 'תהליך הבדיקות והפריסה'<br>*developers:* pipeline (Latin) or 'תהליך ה־CI' | ה־pipeline · m |  | Practitioners use the English (hebrewglot transliterates פייפליין, but job posts and blogs keep Latin). Hebrew calques are not used.<br>**Not:** צינור, צנרת, פייפליין [1](https://hebrewglot.com/en/blog/hebrew-for-developers) |
| **test** (tests, testing, checks) | C | בדיקה<br>*public:* בדיקות<br>*developers:* בדיקות יחידה / בדיקות מקצה לקצה | בדיקות · הבדיקות · f | `seo.siteSocial`, `accessibility-statement.limitItems.2`, `post tag 'testing'` | Hebrew Wikipedia: Software testing → בדיקות תוכנה; hebrewglot gives בדיקות as the noun (לטסט only as slang verb).<br>**Not:** טסט, טסטים, מבחן, מבחנים [1](https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=he) [2](https://hebrewglot.com/en/blog/hebrew-for-developers) |
| **production** | D | סביבת הייצור<br>*public:* Avoid; 'האתר החי' → 'האתר' / 'פעיל'<br>*developers:* סביבת הייצור | סביבת הייצור · f |  | Practitioners say פרודקשן; Microsoft uses ייצור. Owner rejected באוויר.<br>**Not:** פרודקשן, פרוד, באוויר [1](https://hebrewglot.com/en/blog/hebrew-for-developers) [2](https://learn.microsoft.com/he-il/training/modules/introduction-to-github/3-components-of-github-flow) |
| **rollback / restore** | C | שחזור | שחזורים · השחזור · m | `admin-settings.restore`, `admin-settings.restoreLabel`, `admin-settings.intro` | Owner-approved: restore → שחזור (buttons are nouns).<br>**Not:** רולבק, להחזיר (as a button) |
| **bug** | B | באג | באגים · הבאג · m |  | Hebrew Wikipedia's article is titled באג; universal usage.<br>**Not:** תקל, חרק, פשפש [1](https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=he) [2](https://hebrewglot.com/en/blog/hebrew-for-developers) |
| **debug** (debugging) | C | ניפוי באגים | ניפוי הבאגים · m |  | Hebrew Wikipedia: Debugging → ניפוי שגיאות; ניפוי באגים is the common practitioner form and pairs with באג.<br>**Not:** דיבאג, להדביג, לדבג [1](https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=he) [2](https://hebrewglot.com/en/blog/hebrew-for-developers) |
| **code review** | C | סקירת קוד | סקירות קוד · סקירת הקוד · f |  | Hebrew Wikipedia titles it סקר קוד (rare); Microsoft and the site use סקירה ('סקירה ופרסום' in the editor). Practitioners say קוד ריוויו in speech.<br>**Not:** קוד ריוויו, סקר קוד, ביקורת קוד [1](https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=he) [2](https://hebrewglot.com/en/blog/hebrew-for-developers) |
| **review (editor step)** | C | סקירה |  · f | `note-editor.review`, `note-editor.reviewTitle` |  |
| **dry run** | C | הרצה יבשה | ההרצה היבשה · f | `mcp.howItems.1`, `mcp.toolsDo.*` | Owner-approved phrasing 'פעולות כתיבה מתבצעות כהרצה יבשה'.<br>**Not:** דריי ראן, כתיבות הן הרצות יבשות |
| **hotfix** | C | תיקון דחוף | תיקונים דחופים · m |  | Microsoft MT 'תיקון חם' is a calque.<br>**Not:** הוטפיקס, תיקון חם [1](https://learn.microsoft.com/he-il/training/modules/introduction-to-github/3-components-of-github-flow) |
| **feature** | C | יכולת<br>*developers:* תכונה acceptable | יכולות · היכולת · f |  | hebrewglot lists פיצ׳ר as speech; Microsoft uses תכונה.<br>**Not:** פיצ׳ר, פיצ'ר [1](https://hebrewglot.com/en/blog/hebrew-for-developers) [2](https://learn.microsoft.com/he-il/training/modules/introduction-to-github/) |
| **container** | B | קונטיינר | קונטיינרים · הקונטיינר · m | `Bothy posts (Docker)` | Only practitioners' word exists in use; product name Docker stays Latin.<br>**Not:** מכולה, מיכל |
| **self-hosting** | C | אירוח עצמי |  · m | `post tag 'self-hosting' (value stays Latin)` | <br>**Not:** סלף הוסטינג |
| **observability / monitoring** | C | ניטור |  · m | `post tag 'observability'` | <br>**Not:** אובזרבביליות, תצפיתיות |
| **infrastructure** | C | תשתיות |  · f | `seo.homeNotes`, `seo.blogsDescription` |  |
| **performance** | C | ביצועים |  · m | `post tag 'performance'` |  |
| **security** | C | אבטחה |  · f | `post tag 'security'` |  |
| **privacy** | C | פרטיות |  · f | `post tag 'privacy'` |  |
| **auth / authentication** | C | אימות |  · m | `post tag 'auth'` | Hebrew Wikipedia: Authentication → אימות זהות.<br>**Not:** אותנטיקציה, אוט׳ [1](https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=he) |
| **full-stack** (Full-stack engineer, full stack) | B | פול־סטאק<br>*public:* מהנדס פול־סטאק<br>*admin:* פול־סטאק | n/a (adjective/noun) · n/a | `home.role`, `page-names.homeTitle`, `notes.authorRole`, `seo.siteTitle` +3 | Owner-approved. Israeli job posts write it every way (Drushim: 'פול סטאק', 'פול-סטאק', 'FULL STACK'); the maqaf form is the typographically correct choice.<br>**Not:** פול סטאק, פול-סטאק (ASCII hyphen), פולסטאק, Full Stack (in Hebrew copy) [1](https://www.drushim.co.il/article/385/) |
| **frontend** (front end, front-end) | B | פרונטאנד | הפרונטאנד · m | `hero tagline`, `seo.homeNotes`, `seo.blogsDescription` | Owner-approved. Job posts use both 'פרונט אנד' and 'פרונטאנד' (AllJobs, Jobify); Hebrew Wikipedia's קצה קדמי is unused in practice.<br>**Not:** פרונט אנד, פרונט-אנד, פרונטנד, קצה קדמי, צד לקוח (on this site) [1](https://www.alljobs.co.il/m/p/jobs/8851698) [2](https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=he) |
| **backend** (back end, back-end) | B | בקאנד<br>*public:* בקאנד, parallel to פרונטאנד; 'צד שרת' acceptable in prose about servers | הבקאנד · m | `seed.ts project facts ('back end')`, `previously seo.homeNotes (now frontend)` | Contested: no owner ruling. One word mirrors the owner's פרונטאנד; hebrewglot writes בק-אנד, Drushim uses צד שרת, Wikipedia קצה אחורי. Ask the owner before first use.<br>**Not:** בק אנד, בק-אנד, קצה אחורי, בקנד, צד־שרת (with maqaf) [1](https://hebrewglot.com/en/blog/hebrew-for-developers) [2](https://www.drushim.co.il/article/385/) [3](https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=he) |
| **DevOps** | A | DevOps |  · m |  | Hebrew Wikipedia's article is titled DevOps in Latin.<br>**Not:** דבאופס, דב־אופס [1](https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=he) |
| **engineer** | C | מהנדס | מהנדסים · m | `seo.jobTitle`, `notes.authorRole` |  |
| **developer / developers** | C | מפתח<br>*public:* nav/eyebrow: 'למפתחים' | מפתחים · המפתחים · m | `mcp.eyebrow`, `footer` | Owner-approved: developers → למפתחים.<br>**Not:** דבלופרים |
| **technical team lead** | C | ראש צוות טכני |  · m | `home.role`, `dashboard.role`, `seo.*` | <br>**Not:** טים ליד, ראש צוות (alone) |
| **stack (tech stack)** (Stack, Built with, tech) | D | טכנולוגיות<br>*public:* טכנולוגיות (projects.stack) / טכנולוגיה (facet label)<br>*developers:* סטאק only inside פול־סטאק |  · f | `projects.stack`, `work.facet.stack`, `projects.builtWith` | Hebrew Wikipedia has סטאק (תוכנה) but a lay reader parses טכנולוגיות. Minor inconsistency: projects.stack is plural, work.facet.stack singular — acceptable for a facet label, but pick one.<br>**Not:** סטאק (standalone in UI), ערימה, מחסנית [1](https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=he) |
| **framework** | B | פריימוורק<br>*public:* Prefer naming it (React, Fastify) | פריימוורקים · הפריימוורק · m |  | Hebrew Wikipedia's שלד תוכנה is not used by practitioners; job posts write 'framework' or the product name. Not currently in UI.<br>**Not:** שלד תוכנה, מסגרת עבודה [1](https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=he) [2](https://www.alljobs.co.il/m/p/jobs/8851698) |
| **library (code)** | C | ספרייה | ספריות · הספרייה · f |  | Hebrew Wikipedia: ספרייה (תכנות). Also used for the media library.<br>**Not:** לייבררי [1](https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=he) |
| **technology** | C | טכנולוגיה | טכנולוגיות · f | `hero corner phrase 'Technology' (owner copy)` |  |
| **API** | A | API<br>*public:* First mention 'ממשק (API)' if needed<br>*developers:* API | ממשקי API · ה־API · m | `seed.ts project facts ('file API')` | Masculine because the head noun is ממשק. Hebrew Wikipedia: ממשק תכנות יישומים (encyclopedic only). The Academy's מנשק was publicly rejected (ynet).<br>**Not:** APIים, איי־פי־איי, מנשק, ממשק תכנות יישומים (in UI) [1](https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=he) [2](https://www.ynet.co.il/articles/0,7340,L-2296494,00.html) |
| **MCP** (Model Context Protocol, MCP server) | A | MCP<br>*public:* שרת MCP<br>*developers:* 'Model Context Protocol‏ (MCP)' on first mention, Latin name kept | שרתי MCP · ה־MCP · m | `footer.mcp`, `page-names.mcp`, `mcp.title`, `mcp.intro` +1 | Owner-approved intro 'האתר תומך ב־Model Context Protocol‏ (MCP)'. Hebrew Wikipedia's title פרוטוקול הקשר מודל is a word-for-word calque nobody uses.<br>**Not:** פרוטוקול הקשר מודל, מ־סי־פי [1](https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=he) |
| **server** | C | שרת | שרתים · השרת · m | `notes.noAnswer`, `reader.noAnswer`, `mcp.checking`, `approved noAnswerBody` |  [1](https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=he) |
| **client (software)** | D | לקוח<br>*public:* Prefer 'אפליקציה' — לקוח reads as customer<br>*developers:* לקוח MCP | לקוחות · הלקוח · m | `mcp.intro`, `mcp.howBefore`, `mcp.toolsDo.read_audit_log` | Hebrew Wikipedia: תוכנת לקוח. Fine on the developers page where context is clear.<br>**Not:** קליינט [1](https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=he) |
| **tool (MCP tool)** | C | כלי | כלים · הכלי · m | `mcp.tools`, `mcp.tool`, `mcp.publicOnly`, `home.spec.Tools` |  |
| **endpoint** | C | נקודת קצה<br>*developers:* נקודת קצה; the URL itself stays Latin and isolated | נקודות קצה · נקודת הקצה · f | `mcp.skipSignIn` | Already used; practitioners say אנדפוינט but the Hebrew is transparent. Evidence: none fetched beyond the site's own usage — weak.<br>**Not:** אנדפוינט |
| **token / access token** | C | אסימון / אסימון גישה<br>*developers:* אסימון גישה; optionally 'אסימון גישה (access token)' on first mention | אסימונים / אסימוני גישה · האסימון · m | `mcp.howItems.0`, `mcp.howItems.2` | Contested: developers say טוקן. אסימון is the formal term (used in Israeli banking/2FA copy) and already on the page. Could not fetch a Microsoft terminology entry to confirm — evidence weak.<br>**Not:** טוקן, טוקנים |
| **OAuth** (OAuth 2.1, PKCE) | A | OAuth | ה־OAuth · m | `mcp.howBefore` | Hebrew Wikipedia keeps OAuth in Latin. Isolate 'OAuth 2.1' and 'PKCE' with LRI/PDI. [1](https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=he) |
| **scope (OAuth)** (mcp:read, mcp:write) | D | גישת קריאה / גישת כתיבה<br>*developers:* Hebrew label + scope id in Latin in parentheses: 'גישת קריאה (mcp:read)' |  · f | `mcp.readHead`, `mcp.writeHead` | <br>**Not:** סקופ, היקף |
| **consent screen** | C | מסך הסכמה |  · m | `mcp.howItems.1` |  |
| **audit log** | C | יומן ביקורת | יומן הביקורת · m | `mcp.howItems.1` | <br>**Not:** לוג אודיט, לוג |
| **channel log / activity log** | C | יומן פעילות | יומן הפעילות · m | `page-names.log`, `log.feedTitle`, `dashboard.channelLog`, `mcp.intro` +1 | Owner-approved: יומן פעילות everywhere.<br>**Not:** יומן הערוץ, לוג |
| **sign in / sign-in** (log in, login) | C | התחברות |  · f | `mcp.signIn`, `mcp.skipSignIn`, `mcp.how`, `admin-settings.notAuthorised` | Hebrew Wikipedia: כניסה למערכת; Israeli UIs use התחברות.<br>**Not:** לוגין, כניסה (as the button) [1](https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=he) |
| **sign out** | C | התנתקות |  · f | `admin-shell.signOut` | <br>**Not:** לוגאאוט, יציאה |
| **revoke** | C | ביטול |  · m | `mcp.howItems.2` | <br>**Not:** שלילה |
| **connector / custom connector** | D | מחבר / מחבר מותאם אישית<br>*developers:* Claude's own menu path stays Latin and isolated: Settings → Connectors → Add custom connector |  · m | `mcp.desktop`, `seo.mcpConnector` | <br>**Not:** קונקטור |
| **connected apps** | C | אפליקציות מחוברות |  · f | `page-names.connections` |  |
| **app** | C | אפליקציה | אפליקציות · האפליקציה · f | `story.figures.In a store → בחנויות האפליקציות` | Hebrew Wikipedia titles Mobile app as יישומון (Academy term); Google's and Israeli consumer UIs use אפליקציה.<br>**Not:** יישומון, אפליקצייה [1](https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=he) |
| **JSON** | A | JSON | ה־JSON · m |  |  |
| **URL / address** | D | כתובת<br>*public:* כתובת<br>*admin:* כתובת (slug, canonical)<br>*developers:* כתובת; the URL string itself Latin, isolated | כתובות · הכתובת · f | `note-editor.coverHelp`, `note-editor.slugHelp`, `work.notHereBody`, `seo.mcpConnector` | <br>**Not:** URLים, יו־אר־אל, לינק (for URL) |
| **link** | C | קישור | קישורים · הקישור · m | `notes.linkCopied`, `history.copyLink`, `note-editor.tools.link` | <br>**Not:** לינק |
| **webhook** | A | webhook | ה־webhook · m |  | No Hebrew Wikipedia article; not in UI. Keep Latin if ever needed.<br>**Not:** וובהוק, קרס רשת [1](https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=he) |
| **RSS** | A | RSS | ה־RSS · m | `log.rss`, `history.rss`, `work.feed`, `log.subscribeBody` +1 | Hebrew Wikipedia keeps RSS in Latin. Standalone 'RSS' fails words.test (KEPT_IN_LATIN is empty) — every Hebrew entry must carry a Hebrew word, e.g. 'RSS של התחום'. [1](https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=he) |
| **feed** | B | פיד | פידים · הפיד · m | `dashboard.feed`, `work.feed`, `history.emptyAreaBody` | Common Israeli usage (social feeds). No Hebrew Wikipedia article for Web feed.<br>**Not:** הזנה, ערוץ [1](https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=he) |
| **Markdown** | A | Markdown | ה־Markdown · m | `note-editor.bodyHelp` | Hebrew Wikipedia keeps Markdown.<br>**Not:** מרקדאון [1](https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=he) |
| **README** | A | README | ה־README · m |  | <br>**Not:** רידמי, קרא אותי |
| **docs** (documentation, published docs) | C | תיעוד | התיעוד · m | `work.tab.docs`, `work.noDocs`, `work.docsFrom`, `history.docs` +1 | Owner-approved: docs → תיעוד.<br>**Not:** מסמכים (for docs), דוקס, דוקומנטציה |
| **index (search engines)** | B | לאנדקס<br>*admin:* לאנדקס is accepted admin vocabulary |  · n/a | `note-editor.noindex` | The 'live index' meaning (work.liveFailed) was replaced by 'הנתונים העדכניים מ־GitHub' in the approved review — don't use אינדקס for the site's own data. |
| **SEO** | C | חיפוש ושיתוף |  · m | `note-editor.seo`, `note-editor.seoTitle`, `note-editor.seoDescription` | Describes what the fields do for a non-specialist.<br>**Not:** SEO (as a heading), קידום אתרים |
| **cache** | C | מטמון | המטמון · m |  | Hebrew Wikipedia: זיכרון מטמון. Not in UI today.<br>**Not:** קאש [1](https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=he) |
| **database** | C | מסד נתונים | מסדי נתונים · m |  | Hebrew Wikipedia and hebrewglot both give מסד נתונים.<br>**Not:** דאטאבייס, בסיס נתונים [1](https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=he) [2](https://hebrewglot.com/en/blog/hebrew-for-developers) |
| **Docker / React / Node.js / TypeScript / PostgreSQL / MongoDB / Vite / Fastify / Drizzle ORM / Traefik / Grafana / VictoriaMetrics / Keycloak / Tailscale / Fly.io / Manifest V3 / CSS** | A | Latin, as named |  · m | `backend/src/content/seed.ts tech arrays`, `post tags` | Product names. Hebrew Wikipedia keeps Docker in Latin. Rendered with lang='en' dir='ltr' via inEnglish() when a whole field is Latin.<br>**Not:** ריאקט, דוקר, נוד, טייפסקריפט [1](https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=he) |
| **Chrome extension** (extension, chrome-extension) | C | תוסף ל־Chrome | תוספים · התוסף · m | `post tag 'chrome-extension' (value stays Latin)`, `seed.ts (windom)` | Google's own Hebrew Chrome Web Store help uses תוסף/תוספים.<br>**Not:** אקסטנשן, הרחבה [1](https://support.google.com/chrome_webstore/answer/2664769?hl=iw) |
| **browser** | C | דפדפן | דפדפנים · הדפדפן · m | `accessibility-statement.looksItems.1.1`, `accessibility-statement.limitItems.2`, `mcp.signIn` | <br>**Not:** בראוזר [1](https://support.google.com/chrome_webstore/answer/2664769?hl=iw) [2](https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=he) |
| **tab (browser)** | D | לשונית<br>*public:* Contested: Google's Hebrew Chrome help uses כרטיסייה; the site uses לשונית. Pick one site-wide. | לשוניות · הלשונית · f | `projects.opensFor`, `work.tabs (page sections)` | Both words are standard; Chrome's Hebrew UI says כרטיסייה. The site's in-page tab list (work.tabs = חלקי הפרויקט) sidesteps it.<br>**Not:** טאב [1](https://support.google.com/chrome_webstore/answer/2664769?hl=iw) |
| **address bar** | C | שורת הכתובת |  · f | `history.copyFailed` | Chrome's Hebrew help says סרגל הכתובות; שורת הכתובת is equally common. Keep. [1](https://support.google.com/chrome_webstore/answer/2664769?hl=iw) |
| **clipboard** (copied to the clipboard) | C | לוח |  · m | `mcp.copiedSay` | Hebrew Wikipedia: לוח העתקה; 'הועתק ללוח' is standard. [1](https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=he) |
| **keyboard shortcuts / key names** | A | Enter, Escape, Home, End, Ctrl+B …<br>*public:* Key names stay Latin as printed on keys; prefix with maqaf: 'ו־Home'; a key name opening a line gets an RLM before it. |  · n/a | `city.frame`, `dashboard.askHint`, `dashboard.treeHint`, `history.keysHint` +2 | Israeli keyboards print Latin key names. dashboard.askHint already starts with RLM ('‏# בוחר נושא'). |
| **screen reader** | C | קורא מסך | קוראי מסך · m | `accessibility-statement.*` |  [1](https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=he) |
| **WCAG / IS 5568** | A | WCAG / ת״י 5568 |  · m | `accessibility-statement.intro` | IS 5568 is officially ת״י 5568 (gershayim U+05F4) in Hebrew; either form is understood — the statement currently keeps IS 5568. |
| **note / post** (notes, post, posts) | C | רשימה | רשימות · הרשימה · f | `everywhere: notes.*, reader.*, dashboard.*, history.*, note-editor.*, mcp.toolsDo.*` | Owner-binding (#287/#290): note → רשימה, never רשומה. note-editor had רשומה before #290; verify none returns.<br>**Not:** רשומה, רשומות, פוסט, מאמר (for an item) |
| **blog** | C | בלוג | n/a (one blog) · הבלוג · m | `footer.blogs`, `nav` | Owner-approved; Hebrew Wikipedia: בלוג.<br>**Not:** בלוגים, יומן רשת [1](https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=he) |
| **work / projects** | C | פרויקטים | פרויקטים · m | `footer.work`, `work.title`, `nav/projects` | <br>**Not:** עבודות, תיק עבודות |
| **area** | C | תחום | תחומים · התחום · m | `reader.area`, `dashboard.*`, `work.areas`, `history.*` +2 | <br>**Not:** אזור (for area), קטגוריה |
| **draft** | C | טיוטה | טיוטות · הטיוטה · f | `note-editor.status.draft`, `note-editor.saveNow`, `note-editor.unpublish`, `mcp.toolsDo.*` | <br>**Not:** דראפט [1](https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=he) |
| **publish** (published, unpublish, first publish) | C | פרסום |  · m | `note-editor.publish`, `note-editor.firstPublish`, `reader.published`, `mcp.toolsDo.publish_post` | Wix's Hebrew help labels Publish as פרסום; owner rejected יעלה לאוויר.<br>**Not:** עלייה לאוויר, יעלה לאוויר, פאבליש [1](https://support.wix.com/he/article/wix-editor-publishing-your-site) |
| **preview** | C | תצוגה מקדימה |  · f | `note-editor.preview`, `note-editor.previewLabel` | Wix Hebrew help: Preview (תצוגה מקדימה).<br>**Not:** פריוויו [1](https://support.wix.com/he/article/wix-editor-publishing-your-site) |
| **archive** | C | ארכיון |  · m | `note-editor.status.archived`, `mcp.toolsDo.delete_post`, `work STATE_WORDS.archive` |  |
| **autosave** | C | שמירה אוטומטית |  · f | `note-editor.neverPublished`, `note-editor.newNoteHint` |  |
| **upload** | C | העלאה |  · f | `note-editor.uploading`, `note-editor.uploaded`, `note-editor.uploadFailed`, `note-editor.bodyHelp` | <br>**Not:** אפלוד |
| **media library** | C | ספריית המדיה |  · f | `mcp.toolsDo.list_media`, `note-editor.tools.image` |  |
| **code (inline / block)** | C | קוד / בלוק קוד |  · m | `note-editor.tools.code`, `note-editor.tools.codeblock`, `reader.copyCode` | בלוק is accepted; the alternative קטע קוד is fine in prose. |
| **slug** | C | כתובת |  · f | `note-editor.slugHelp` | <br>**Not:** סלאג |
| **canonical URL** | C | הכתובת המקורית |  · f | `note-editor.canonicalHelp` | <br>**Not:** קנוני |
| **featured** (featured order, not featured) | C | מומלצות |  · f | `dashboard.featured`, `note-editor.featured`, `note-editor.notFeatured` | Owner-approved.<br>**Not:** נבחרת, נבחרות (for featured), פיצ׳רד |
| **pinned** | C | מוצמדים |  · m | `work.pinned`, `work.lede` |  |
| **admin** | C | ניהול |  · m | `footer.admin`, `page-names.admin`, `admin-shell.*`, `mcp.howItems.2 (ממשק הניהול)` | <br>**Not:** אדמין, מנהל (for the area) |
| **settings** | C | הגדרות |  · f | `admin-settings.title` | Public 'Controls' became תצוגה (owner) so הגדרות is reserved for admin settings.<br>**Not:** סטינגס |
| **theme** (dark, light, system, dark mode) | C | ערכת צבעים<br>*public:* בהירה / כהה / לפי המערכת | ערכות צבעים · f | `chrome.theme`, `chrome.themeDark`, `admin-settings.themeLegend` | <br>**Not:** תמה, ת׳ים, דארק מוד, מצב לילה |
| **dashboard** | D | לוח בקרה<br>*public:* Not shown; the notes dashboard is just 'בלוג'<br>*admin:* לוח בקרה if ever needed |  · m |  | Not a visible word on the site. Could not verify Microsoft's Hebrew Power BI term (he-il page redirected to English); monday.com's Hebrew help was not reachable. Weak evidence; decision by readability.<br>**Not:** דשבורד, לוח מחוונים |
| **hero** | C | פתיח |  · m | `admin-settings.hero`, `admin-settings.homeHint` | <br>**Not:** הירו, באנר |
| **section** | C | אזור | אזורים · m | `admin-settings.sections.*`, `admin-settings.issues.*` |  |
| **accent colour** | C | צבע הדגשה |  · m | `admin-settings.accentLegend` |  |
| **contrast** | C | ניגודיות |  · f | `chrome.contrast` |  |
| **motion / pause motion** | C | השהיית תנועה |  · f | `chrome.pauseMotion`, `chrome.motionPaused` | Owner-approved.<br>**Not:** עצירת תנועה |
| **retry** | C | ניסיון חוזר |  · m | `dashboard.retry` | <br>**Not:** לנסות שוב (as a button) |
| **loading** | C | נטען / נטענת |  · n/a | `admin-settings.loading`, `work.loadingProject` | Owner: loading → 'הרשימה נטענת…' (state, not 'טוען…' with an implied 'I'). |
| **live (status)** | C | פעיל | פעילים · m | `home.spec.Live`, `mcp.live`, `work STATE_WORDS.live` | <br>**Not:** באוויר, לייב |
| **specs** | C | במספרים |  · n/a | `admin-settings.sections.stack`, `home specs` | <br>**Not:** נתונים, ספקס |
| **elsewhere (links)** | C | ברשת |  · n/a | `chrome.elsewhere`, `footer.elsewhere`, `seo.elsewhere`, `projects.elsewhere` | <br>**Not:** במקומות אחרים |
| **email** (mail) | C | אימייל |  · m | `chrome.email`, `contact.*` | Approved contact.fact uses 'במייל' in prose; the label stays אימייל.<br>**Not:** דוא״ל (inconsistent with chrome.email), מייל (in labels; fine in prose) |
| **open in a new tab** | C | נפתח בלשונית חדשה |  · n/a | `projects.opensFor` |  |

## 7. Sources

- <https://learn.microsoft.com/he-il/training/modules/introduction-to-github/>: Microsoft Learn he-il, machine-translated (ms.translationtype: MT). Uses בקשות משיכה, הסתעפויות, בקשות ביצוע, בעיות, מאגרים — evidence of literal MT, not of practitioner usage.
- <https://learn.microsoft.com/he-il/training/modules/introduction-to-github/3-components-of-github-flow>: Same module, unit 3 (MT). Inconsistent: סניפים and ענפים for branches; התחייבויות/ביצוע/מבצע for commits; דחיפת ביצוע for push; בקשת משיכה; מיזוג; ענפי שחרור/הפצה/מהדורה for release. Shows why calques must be rejected.
- <https://learn.microsoft.com/he-il/azure/devops/repos/git/pull-requests>: Requested the he-il Azure DevOps PR page; it served the English original (no Hebrew translation available). Could not confirm 'בקשת משיכה' in a human-reviewed Microsoft product string.
- <https://he.wikipedia.org/wiki/%D7%92%D7%99%D7%98>: Hebrew Wikipedia 'גיט': מאגר and רפוזיטורי, ענף (branch), גרסה (revision/commit), מיזוג (merge), דחיפות/משיכות; Latin in parentheses.
- <https://he.wikipedia.org/wiki/GitHub>: Hebrew Wikipedia 'GitHub': מאגר (repository), בקשת משיכה (pull request), פיצול (fork), קוד פתוח; 'Issues' kept in Latin; stars paraphrased as מועדפים.
- <https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=he>: Wikipedia API en→he interlanguage titles (fetched): API→ממשק תכנות יישומים; Repository→רפוזיטורי (ניהול גרסאות); Fork→פיצול (פיתוח תוכנה); Software bug→באג; Debugging→ניפוי שגיאות; Continuous integration→אינטגרציה רציפה; Software deployment→פריסת תוכנה; Front end and back end→קצה קדמי וקצה אחורי; Solution stack→סטאק (תוכנה); Software framework→שלד תוכנה; Library→ספרייה (תכנות); Software license→רישיון תוכנה; Open-source software→קוד פתוח; Source code→קוד מקור; Cache→זיכרון מטמון; Client→תוכנת לקוח; Server→שרת (מחשבים); Code review→סקר קוד; Software testing→בדיקות תוכנה; Plug-in→תוסף; Web browser→דפדפן; Tag (metadata)→תגית; Mobile app→יישומון; Authentication→אימות זהות; Login→כניסה למערכת; Database→מסד נתונים; Clipboard→לוח העתקה; Screen reader→קורא מסך; Model Context Protocol→פרוטוקול הקשר מודל; Latin titles kept for DevOps, Docker, Markdown, OAuth, RSS, Diff. No Hebrew article for commit, branching, merge, pull request, webhook, web feed, access token, browser extension, dark mode, full-stack developer.
- <https://ohshitgit.com/he>: Hebrew translation of a popular git guide: קומיט/קומיטים, ברנץ׳/ברנצ׳ים, ריפו, מרג׳, דחפת — practitioner register.
- <https://internet-israel.com/category/%D7%9E%D7%93%D7%A8%D7%99%D7%9B%D7%99%D7%9D/git/>: Long-running Hebrew web-dev blog: 'יצירת pull request', 'PR ענקיים' (masc. plural), 'מה זה קומיט', ענפים (branches), 'דחיפה שלו לשרת', 'למזג'; mixes Latin and Hebrew.
- <https://www.codebrain.co.il/%D7%9E%D7%93%D7%A8%D7%99%D7%9A-%D7%9C-git-%D7%A0%D7%99%D7%94%D7%95%D7%9C-%D7%92%D7%A8%D7%A1%D7%90%D7%95%D7%AA-%D7%A7%D7%95%D7%93/>: Hebrew git tutorial: keeps Repository, Commit, Push, Clone in Latin; ענפים (branches), למזג (merge).
- <https://hebrewglot.com/en/blog/hebrew-for-developers>: Hebrew-for-developers glossary: ריפו, ברנץ׳, קומיט, פוש, מרג׳, דפלוי, באג, קוד ריוויו, פרונט-אנד, בק-אנד, פול-סטאק, רליז, פיצ׳ר, פייפליין, מסד נתונים, בדיקות; labels לדפלוי/לדביג/לפושר as slang. Secondary source (a learner site), useful for spoken register only.
- <https://www.drushim.co.il/article/385/>: Drushim (Israeli job board) article: 'פול סטאק', 'פול-סטאק', 'FULL STACK', 'full stack' all on one page; צד לקוח / צד שרת; database in Latin.
- <https://www.alljobs.co.il/m/p/jobs/8851698>: AllJobs posting title 'מפתח/ת פרונט אנד'; search snippets from Jobify also show 'פרונטאנד' and Latin 'Frontend' — usage is split.
- <https://support.google.com/chrome_webstore/answer/2664769?hl=iw>: Google's Hebrew Chrome Web Store help: תוסף/תוספים (extension), דפדפן, סרגל הכתובות, כרטיסייה (tab), הרשאות; proxy/VPN kept Latin.
- <https://support.wix.com/he/article/wix-editor-publishing-your-site>: Wix Hebrew help (Israeli product): Publish (פרסום), Preview (תצוגה מקדימה), 'האתר שבאוויר' / 'האתר הפעיל'; keeps English button labels in Latin with Hebrew gloss.
- <https://www.ynet.co.il/articles/0,7340,L-2296494,00.html>: ynet article (dated on page 05.12.02): Academy computing terms the public rejected — מנשק (interface), סיבית (bit), בית (byte), הידודי (interactive).
- <https://terms.hebrew-academy.org.il/>: Academy of the Hebrew Language term database: a query for 'repository' returned 0 entries via fetch; the search UI needs interaction. No Academy entries for git vocabulary could be confirmed.
- <https://docs.github.com/en>: GitHub Docs: fetched page did not expose the language picker, so the absence of Hebrew could not be verified by fetch. GitHub's product UI is not localized into Hebrew (general knowledge, unverified here).
- <https://learn.microsoft.com/he-il/power-bi/create-reports/service-dashboards>: Requested he-il; served English. Microsoft's Hebrew term for 'dashboard' not confirmed.
- <https://source.android.com/source/?hl=he>: Android source site in Hebrew (search snippet): 'סטאק תוכנה בקוד פתוח', 'תרומה לה' — סטאק and תרומה in Google Hebrew copy.
- The owner-approved copy review (merged as #290): Owner-approved copy review; merged as PR #290 (worktree HEAD 0b6714f). Binding choices: רשימה, תיעוד, עדכוני קוד, מומלצות, למפתחים, ניסיון חוזר, בלוג, פרויקטים, פול־סטאק, פרונטאנד, יומן פעילות, במספרים, ברשת, שחזור, השהיית תנועה.
- docs/hebrew/strings.md: Repo inventory of every Hebrew string (#287): פיצולים over מזלגות, פעילים over באוויר, and the list of items shown in English on /he.
