# Phone editors (#683): before and after

Screenshots of /admin/projects, /admin/story and /admin/site-copy from `web/scripts/a11y/admin-editors-phone.mjs` (`SHOTS=<dir>`), at 360/390/430 and 1440, en (LTR) and he (RTL), light and dark. `before/` is main at the time (390 and 1440 only; its `-open` shot is the whole page); `after/` is this branch. `-reorder` is Reorder mode.

Density at 390x844 (`npm run a11y:density`, light, en):

| screen | before (score, viewport heights) | after |
|---|---|---|
| projects | 57.7, 9.76 | 34.9, 1.83 |
| projects ?project=3 | 57.6, 9.66 | 34.9, 1.83 |
| story | 46.2, 7.34 | 22.6, 1.12 |
| site-copy | 46.5, 13.81 | 38.3, 2.43 |

At 360x740: projects 11.13 to 2.12, story 8.51 to 1.28, site-copy 16.14 to 2.77.
First screen of projects (390x844): four project rows, the language switch and the Basics header, above the save bar.
