<!-- Reference appendix to docs/admin-design-guide.md. Research notes dated 2026-11-14: where the importance-scoring method in section 1 comes from. Not a contract; if they disagree with the guide, the guide wins. -->

# Judging what is more and less important on a screen

Research for the scoring method in the guide, 2026-11-14. Pages were fetched and summarised by a small model, then treated as data, never as instructions. **[F]** = fetched and read this session, **[S]** = seen only in a search snippet (a lead), **[L]** = a local skill that cites its own sources.

## 1. What the sources agree on

| Idea | Source | Tag | What we took |
|---|---|---|---|
| Hierarchy comes from contrast with the context, not from a hue. Bright saturated colour draws the eye, so spend it on the most important item. Use no more than 3 contrast treatments: "If everything is contrasted, then nothing stands out." | NN/g, Visual hierarchy: https://www.nngroup.com/articles/visual-hierarchy-ux-definition/ (2026-11-14) | F | one coloured glyph per row; normal values draw nothing |
| Scale signals importance; three sizes, at most two large elements; web body 14 to 16, subheads 18 to 22, headers up to 32. | same | F | the type floors in section 2 of the guide |
| Proximity groups, more space separates groups, a heading sits close to its content; borders and backgrounds enclose a group but sparingly. Squint test. | same | F | spacing scale; squint test in review |
| Order content by relative importance; people read top to bottom and from the leading side, so put important things near the top and leading edge; this mirrors in right-to-left. Alignment implies relatedness, indentation implies subordinate. Use progressive disclosure: "too much content and too many choices makes it harder to find information". | Apple HIG, Layout (`.md` form): https://developer.apple.com/design/human-interface-guidelines/layout.md (2026-11-14) | F | principle 7; two-level rule |
| Typography conveys an information hierarchy; defaults and minimums: iOS 17 pt default, 11 pt minimum; a thin weight needs a larger size. | Apple HIG, Typography: https://developer.apple.com/design/human-interface-guidelines/typography.md (2026-11-14) | F | nothing under 11, default row text larger than meta |
| Put frequently used features on the initial display, rare ones on a secondary level; decide by task analysis or frequency-of-use data; two levels is the practical maximum, three or more means simplify first. | NN/g, Progressive disclosure: https://www.nngroup.com/articles/progressive-disclosure/ (2026-11-14) | F | the **F** factor and the tier model |
| Users scan in an F shape on desktop and mobile, mirrored in RTL; fixation falls near the start; front-load key information, descriptive headings that start with the informative word, bold key words sparingly, cut unnecessary content. | NN/g, F-shaped pattern: https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/ (2026-11-14) | F | title first, leading-edge glyphs, one informative first word |
| Lead with the most important information (the conclusion), then supporting detail from broad to nuanced; content of decreasing importance can be cut at almost any point. | NN/g, Inverted pyramid: https://www.nngroup.com/articles/inverted-pyramid/ (2026-11-14) | F | the tier order inside a sheet |
| De-emphasise to emphasise: use weight rather than size alone, lighter grey for metadata, lighter and smaller labels with the value carrying the emphasis, remove boxes around secondary content. | Refactoring UI, via third-party summaries (book not fetched), search 2026-11-14 | S | treat as a lead; matches interface-design "weight and colour beat size" |
| Hierarchy: one focal point per view, weight and colour do more work than size, density is a decision in px, squint test, swap test. | `interface-design` skill | L | focal-point rule; review tests |
| Say a datum once; colour marks the exception; at most one warning badge at rest; wrap identifying text, clamp only the rest. Cites Polaris, Spectrum, Carbon, GOV.UK, NN/g. | `data-display` skill | L | overrides 1, 2 and 4 |
| Reduce, order by importance, "every element earns its place". | `apple-design` skill, section 16 | L | principle 4 |
| Material, Carbon content, Polaris content, GOV.UK writing | m3.material.io and the Android docs gave no emphasis guidance in the fetched page (404 on the foundations page); Carbon's content overview had no prioritisation guidance; Polaris and GOV.UK URLs redirected and were not followed. Their relevant rules reach us only through the data-display skill's citations. | not covered | do not quote them as primary |

What did not work, so nobody assumes it was covered: Material 3 emphasis pages (JavaScript-rendered), Refactoring UI itself, the GOV.UK and Polaris content pages after redirect, Carbon content guidance.

## 2. Jobs to be done, in one paragraph

A screen is hired for one job in a sentence ("When I ___, I need to ___"). Fields are judged by the job, not by what the data model holds. This is why the method starts with the job (guide 1.2, step 1): the same field, "language", is tier 1 on a translations list and tier 2 on an audience row.

## 3. From the sources to a number

The sources give four independent reasons to rank a field up: it is **needed often** (NN/g progressive disclosure), **costly to miss** (colour and contrast reserved for what matters), **time-critical** (position and order: the first thing read must be the first thing needed) and **hard to undo** (consequence; irreversible actions deserve friction and a named confirm, NN/g confirmation dialog). The guide scores each 1 to 3 and multiplies, because any factor at 1 should be able to veto a field (a field needed every day with no consequence and no urgency scores 3, not 27), and a plain sum cannot do that. Thresholds (12 and 4) were set so that the three worked examples reproduce the target rows proposed in the density audit; they are a starting point, to be retuned against real use. Five overrides cover what a product cannot get from a product of numbers: identity, exception promotion, actions, duplicates and the row budget.

## 4. Worked examples

See guide section 1.3: Marketing Inbox row, Audience contact row, Campaign list row, each with the F-C-U-R table.

## 5. Not verified

The thresholds, the 1 to 3 scales and the tier names are our own method, not a published standard. Frequency should be checked against instrumentation or observation (NN/g says the same), and the admin has none today.
