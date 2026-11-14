# Admin on a phone: Overview, Connections, Translations, Settings (#682)

Screenshots at 360, 390 and 430 wide (full-page at 390), English and Hebrew RTL, light and dark, plus 1440 desktop (unchanged).
`<screen>-before-390-ltr-light.png` is the desktop layout forced at 390 wide (the phone media query answered "no"), so it is the before.
Regenerate with `SHOTS=<dir> npm run a11y:admin-phone-screens` after `npm run build`.

Page height at 390x844, in viewport-heights (document scrollHeight / 844; a page shorter than the screen reads 1):

| Screen | Before | After | Rows | Cards before / after |
|---|---|---|---|---|
| Overview | 2.85 | 1 | 11 | 0 / 0 |
| Connections | 1.02 | 1 | 4 | 0 / 0 |
| Translations | 1 | 1 | 4 | 0 / 0 |
| Settings (history open) | 4.70 | 1.43 | 8 | 21 / 0 |

The issue's 8.2 for settings-expanded was measured with more history and the form's sections open; with this fixture (7 saved versions) the same page is 4.70 before and 1.43 after.
