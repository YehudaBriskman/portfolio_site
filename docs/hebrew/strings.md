# Hebrew strings (#248)

Every Hebrew string the site shows. Generated from the word tables
(`web/src/i18n/*.ts`, the component `words.ts` files, `nav/navRoutes.ts`) and the
server render's `backend/src/services/seo-words.ts`. A `(…)` key is a function; its
row shows it called with `3` (and `X`, `Y` for further arguments).

The owner approved a full review of this file. Its names, must-fix rows and
consistency terms are applied below.

## Terms used everywhere

| English | Hebrew |
|---|---|
| Home · Journey · Work · Blog | בית · מסלול מקצועי · פרויקטים · בלוג |
| Note (an item) | רשימה, never רשומה |
| Specs · Colophon · Contact | במספרים · על האתר · יצירת קשר |
| Selected work · How I work · The year | פרויקטים נבחרים · איך אני עובד · השנה האחרונה |
| Docs · Push · Featured · Developers | תיעוד · עדכוני קוד · מומלצות · למפתחים |
| Pause motion | השהיית תנועה / התנועה מושהית |
| Retry · Loading a note · Scrolls sideways | ניסיון חוזר · הרשימה נטענת… · נגללת הצידה |
| Newest first | מהחדשה לישנה (always the full pair) |
| Channel log | יומן פעילות (including the feed title) |
| Elsewhere | ברשת |
| The role | ראש צוות טכני; the employer is never named |

Buttons are nouns of action (הצגת, שחזור, הזזת), the reader is addressed in the
plural, and quotes are straight (`"`) site-wide.

## Content translated, not UI

| Field | English | Hebrew | Note |
|---|---|---|---|
| story milestone words | Things other people could open. | דברים שאחרים יכולים לפתוח. | Also in `backend/src/content/seed.ts`. |
| story milestone words | Then, things they relied on. | ואז — מערכות שאחרים סומכים עליהן. | Also in `backend/src/content/seed.ts`. |
| story milestone words | Then, a team. | ואז — צוות. | Also in `backend/src/content/seed.ts`. |
| site copy `hero.fact` (hero tagline) | Yehuda Briskman — full-stack, mostly frontend | Yehuda Briskman — פול־סטאק, עם דגש על פרונטאנד | Approved in the owner's copy review. |
| site copy `hero.where` | Israel | ישראל | |
| site copy `hero.phrases` | Technology · Product builder · Applied AI | טכנולוגיה · בונה מוצרים · בינה מלאכותית יישומית | "Technology" from the review; the other two are proposed. |
| site copy `contact.replyWithin` | Usually within a day | בדרך כלל תוך יום | Proposed. |
| site copy `about.heading` | How I work | איך אני עובד | Approved in the owner's copy review. |
| area `site` title (no record yet) | The site | האתר | Fallback in `BlogArea.tsx` only. |
| areas, posts: `he` fields | (owner's) | (empty) | Written in the area and post editors. |

The site copy Hebrew lives in `web/src/data/site.ts` (`heroHebrew`) and so in the
seed. The seed only writes a document that does not exist yet, so on the running
site these are entered once in Admin > Site copy, under each field's Hebrew.

## Shown in English on /he (marked `lang="en" dir="ltr"`)

| Item | Why |
|---|---|
| The name, Yehuda Briskman | A name; it stays in Latin letters. |
| "Portfolio", the hero's display word | The brand word, in the Latin brand face on both languages. |
| Hero phrases "Build boldly" and "Keep improving" | Mottos with no approved Hebrew. |
| Project descriptions, README overviews, stack names, milestone titles ("Started shipping") | Content from GitHub and the journey data. |
| Post and area title, subtitle, excerpt, body with no `he` field | Per-field fallback; an English body also gets "כתוב באנגלית". |
| Claude's menu path on the MCP page | Claude's own UI names. |

## Every UI string

| Key | English | Hebrew | Alternatives | Note |
|---|---|---|---|---|
| `chrome.skip` | Skip to content | דילוג לתוכן |  |  |
| `chrome.pages` | Pages | עמודים |  |  |
| `chrome.elsewhere` | Elsewhere | ברשת |  |  |
| `chrome.controls` | Controls | תצוגה |  |  |
| `chrome.siteControls` | Site controls | הגדרות האתר |  |  |
| `chrome.menu` | Menu | תפריט |  |  |
| `chrome.language` | Language | שפה |  |  |
| `chrome.changeLanguage(…)` | 3 — change language | 3 — החלפת שפה |  |  |
| `chrome.theme` | Theme | ערכת צבעים |  |  |
| `chrome.themeLight` | Light | בהירה |  |  |
| `chrome.themeDark` | Dark | כהה |  |  |
| `chrome.themeSystem` | System | לפי המערכת |  |  |
| `chrome.systemNow(…)` | System, now 3 | לפי המערכת, כרגע 3 |  |  |
| `chrome.textSize` | Text size | גודל טקסט |  |  |
| `chrome.textDefault` | Default | רגיל |  |  |
| `chrome.textLarge` | Large | גדול |  |  |
| `chrome.textLarger` | Larger | גדול יותר |  |  |
| `chrome.contrast` | Contrast | ניגודיות |  |  |
| `chrome.contrastStandard` | Standard | רגילה |  |  |
| `chrome.contrastMore` | More | מוגברת |  |  |
| `chrome.displayName(…)` | Theme: 3; text size: X; contrast: Y — change display | ערכת צבעים: 3; גודל טקסט: X; ניגודיות: Y — החלפה |  |  |
| `chrome.pauseMotion` | Pause motion | השהיית תנועה |  |  |
| `chrome.motionPaused` | Motion paused. Press to play | התנועה מושהית. לחיצה להפעלה |  |  |
| `chrome.email` | Email | אימייל |  |  |
| `chrome.close` | Close | סגירה |  |  |
| `footer.pages` | Pages | עמודים |  |  |
| `footer.home` | Home | בית |  |  |
| `footer.journey` | Journey | מסלול מקצועי |  |  |
| `footer.work` | Work | פרויקטים |  |  |
| `footer.blogs` | Blogs | בלוג |  |  |
| `footer.mcp` | MCP server | שרת MCP |  |  |
| `footer.elsewhere` | Elsewhere | ברשת |  |  |
| `footer.email` | Email | אימייל |  |  |
| `footer.colophon` | Colophon | על האתר |  |  |
| `footer.accessibility` | accessibility | הצהרת נגישות |  |  |
| `footer.admin` | admin | ניהול |  |  |
| `footer.adminName` | Admin | ניהול |  |  |
| `not-found.eyebrow` | Error 404 | שגיאה 404 |  |  |
| `not-found.title` | Not here | הדף לא נמצא |  |  |
| `not-found.body` | Whatever was at this address has moved, or never existed. | מה שהיה בכתובת הזאת עבר למקום אחר, או שמעולם לא היה. |  |  |
| `not-found.home` | Home | בית |  |  |
| `not-found.projects` | Projects | פרויקטים |  |  |
| `not-found.notes` | Notes | רשימות |  |  |
| `page-names.home` | Home | בית |  |  |
| `page-names.homeTitle` | Yehuda Briskman · Full-stack engineer & team lead | Yehuda Briskman · מהנדס פול־סטאק וראש צוות טכני |  | Role rule: ראש צוות טכני. |
| `page-names.work` | Work | פרויקטים |  |  |
| `page-names.journey` | Journey | מסלול מקצועי |  |  |
| `page-names.mcp` | MCP server | שרת MCP |  |  |
| `page-names.blogs` | Blogs | בלוג |  |  |
| `page-names.log` | Channel log | יומן פעילות |  |  |
| `page-names.accessibility` | Accessibility | נגישות |  |  |
| `page-names.notFound` | Not found | לא נמצא |  |  |
| `page-names.admin` | Admin | ניהול |  |  |
| `page-names.posts` | Posts | רשימות |  |  |
| `page-names.newPost` | New post | רשימה חדשה |  |  |
| `page-names.editing(…)` | Editing 3 | עריכה: 3 |  |  |
| `page-names.connections` | Connected apps | אפליקציות מחוברות |  |  |
| `page-names.areas` | Areas | תחומים |  |  |
| `page-names.newArea` | New area | תחום חדש |  |  |
| `home.getInTouch` | Get in touch | יצירת קשר |  | Buttons are nouns of action. |
| `home.shippingSince(…)` | Shipping since 3 | בתעשייה מאז 3 |  | The hero plate's second field. Approved in the owner's copy review. |
| `home.portraitAlt` | Yehuda Briskman: a cut-out photograph from the waist up, in round sunglasses and a pale T-shirt, a bag strap across one shoulder, looking off to the side. | Yehuda Briskman: תצלום גזור מהמותניים ומעלה, במשקפי שמש עגולים ובחולצת טי בהירה, רצועת תיק על כתף אחת, מביט הצידה. |  |  |
| `home.role` | Full-stack · Technical team lead | פול־סטאק · ראש צוות טכני |  | Role rule: ראש צוות טכני. The employer is never named. |
| `home.work` | Work | פרויקטים |  |  |
| `home.shownOf(…)` | 3 of X | 3 מתוך X |  |  |
| `home.selectedWork` | Selected work | פרויקטים נבחרים |  |  |
| `home.allProjects` | All projects | כל הפרויקטים |  |  |
| `home.specs` | Specs | במספרים |  |  |
| `home.specsNote` | Counted from the work, not claimed | נגזר מהעבודה עצמה, לא מהצהרות |  |  |
| `home.spec.Projects` | Projects | פרויקטים |  |  |
| `home.spec.Live` | Live | פעילים |  |  |
| `home.spec.Tools` | Tools | כלים |  |  |
| `home.spec.Shipping` | Shipping | שנות ניסיון |  |  |
| `home.years` | yrs | שנים |  |  |
| `home.notes` | Notes | רשימות | מאמרים | Items are רשימות (approved). Switching to מאמרים would re-gender ~80 strings. |
| `home.notesNote` | Decisions and what they cost | החלטות והמחיר שלהן |  |  |
| `home.skipNotes` | Skip past the notes | דילוג על הרשימות |  |  |
| `home.latestNotes` | Latest notes | הרשימות האחרונות |  |  |
| `home.notesError` | The notes aren't loading just now. They're still there — the index has all of them. | הרשימות לא נטענות כרגע. הן עדיין שם — כולן זמינות בעמוד הבלוג. |  |  |
| `home.notesNone` | Nothing published yet. The index is where they'll appear. | עדיין לא פורסם כלום. הן יופיעו בעמוד הבלוג. |  |  |
| `home.allNotes` | All notes | כל הרשימות |  |  |
| `home.emptyTitle` | Nothing here yet. | עדיין אין כאן כלום. |  |  |
| `home.emptyBody` | Notes go up as the work gets done. Anything filed here will appear on this page. | רשימות עולות תוך כדי העבודה. כל מה שיתויק כאן יופיע בעמוד הזה. |  |  |
| `home.figure` | Fig. | איור |  |  |
| `contact.fact` | Mail reaches me faster than anything else | הדרך המהירה ביותר להשיג אותי היא במייל |  |  |
| `contact.note` | I’m employed full-time and not looking for freelance work. I do read everything — if you’re hiring, building something you think I’d find interesting, or want to talk about anything on this page, write to me. | אני מועסק במשרה מלאה ולא מחפש עבודות פרילנס. אבל אני קורא הכול — אם אתם מגייסים, בונים משהו שלדעתכם יעניין אותי, או רוצים לדבר על משהו מהעמוד הזה, כתבו לי. |  |  |
| `contact.sent` | Sent. I’ll reply to the address you gave. | נשלח. אענה לכתובת שמסרתם. |  |  |
| `contact.write` | Write a message | כתיבת הודעה |  |  |
| `contact.writeAnother` | Write another message | כתיבת הודעה נוספת |  |  |
| `contact.directBefore` | Or write to | אפשר גם לכתוב ישירות אל |  |  |
| `contact.directAfter` | from wherever you keep your mail. | מכל תיבת דואר. |  |  |
| `contact.allThree` | All three fields are needed. | יש למלא את שלושת השדות. |  |  |
| `contact.close` | Close | סגירה |  |  |
| `contact.formLabel` | Send a message | שליחת הודעה |  |  |
| `contact.name` | Name | שם |  |  |
| `contact.email` | Email | אימייל |  |  |
| `contact.message` | Message | הודעה |  |  |
| `contact.sending` | Sending | בשליחה |  |  |
| `contact.send` | Send message | שליחת ההודעה |  |  |
| `contact.invalid` | Nothing was sent. There's a note under each field that needs a change. | ההודעה לא נשלחה. ליד כל שדה שדורש תיקון מופיעה הערה. |  |  |
| `contact.failed(…)` | Nothing was sent — 3. Your message is still in the fields, and X works too. | שום דבר לא נשלח — 3. ההודעה שלכם עדיין בשדות, ואפשר גם לכתוב אל X. |  |  |
| `contact.unknownFailure` | something went wrong at my end | משהו השתבש אצלי |  |  |
| `contact.errors.name` | Add your name | יש להזין שם |  |  |
| `contact.errors.email` | That email address doesn't look right. It should look like name@example.com | כתובת האימייל לא נראית תקינה. לדוגמה: name@example.com |  |  |
| `contact.errors.message` | Tell me a little more, at least a sentence | כתבו קצת יותר, לפחות משפט אחד |  |  |
| `city.title` | The year | השנה האחרונה |  |  |
| `city.trailing` | Trailing twelve months | שנים־עשר החודשים האחרונים |  |  |
| `city.frame` | The year, day by day. Arrow keys move between days, Home and End go to the first and last. | השנה, יום אחר יום. מקשי החיצים עוברים בין הימים, ו־Home ו־End מגיעים לראשון ולאחרון. |  |  |
| `city.drag` | Drag to turn the city · point at a day | גררו כדי לסובב את העיר · הצביעו על יום |  |  |
| `city.swipe` | Swipe sideways to turn · tap a day | החליקו הצידה כדי לסובב · הקישו על יום |  |  |
| `city.reading` | Reading the year… | קורא את השנה… |  |  |
| `city.contributionsOver(…)` | 3 contributions over X days | 3 תרומות ב־X ימים |  |  |
| `city.between(…)` | , 3 to X | , מ־3 עד X |  |  |
| `city.active(…)` | . 3 of those days have something in them | . ב־3 מהימים האלה יש משהו |  |  |
| `city.busiest(…)` | ; the busiest is 3, at X | ; העמוס ביותר הוא 3, עם X |  |  |
| `city.table` | The year as a table | השנה כטבלה |  |  |
| `city.tableCaption` | Contributions by month over the trailing year, with the number of days of each month that fall inside the window. | תרומות לפי חודש בשנה האחרונה, עם מספר הימים מכל חודש שנכללים בחלון. |  |  |
| `city.month` | Month | חודש |  |  |
| `city.days` | Days | ימים |  |  |
| `city.contributions` | Contributions | תרומות |  |  |
| `notes.minutes.one` | {n} min | דקה |  |  |
| `notes.minutes.other` | {n} min | {n} דק׳ |  |  |
| `notes.minutesRead.one` | {n} min read | דקת קריאה אחת |  |  |
| `notes.minutesRead.other` | {n} min read | {n} דקות קריאה |  |  |
| `notes.more` | More notes | רשימות נוספות |  |  |
| `notes.newer` | Newer | חדשה יותר |  |  |
| `notes.older` | Older | ישנה יותר |  |  |
| `notes.blogs` | Blogs | בלוג |  |  |
| `notes.share` | Share | שיתוף |  |  |
| `notes.linkCopied` | Link copied | הקישור הועתק |  |  |
| `notes.clearTag(…)` | Clear the 3 filter | ביטול הסינון לפי 3 |  |  |
| `notes.tagged(…)` | Notes tagged 3 | רשימות עם התגית 3 |  |  |
| `notes.note` | Note | רשימה |  |  |
| `notes.tableScrolls` | Table, scrolls sideways | טבלה, נגללת הצידה |  |  |
| `notes.loading` | Loading the post | הרשימה נטענת… |  |  |
| `notes.notHere` | Not here | הרשימה לא נמצאה |  |  |
| `notes.missingBefore` | That post doesn’t exist, or isn’t published yet. The address may have changed when the notes moved from | הרשימה הזאת לא קיימת, או שעדיין לא פורסמה. ייתכן שהכתובת השתנתה כשהרשימות עברו מהכתובת |  |  |
| `notes.missingMiddle` | to | לכתובת |  |  |
| `notes.unavailable` | Post unavailable | הרשימה לא זמינה |  |  |
| `notes.noAnswer` | The server didn’t answer. | השרת לא ענה. |  |  |
| `notes.noAnswerBody` | The page loaded; the post behind it didn’t. It is served by a small machine I run myself, so this is usually a restart rather than anything permanent. | העמוד נטען; הרשימה שמאחוריו לא. היא מוגשת משרת קטן שאני מפעיל בעצמי, ולרוב מדובר בהפעלה מחדש ולא בתקלה קבועה. |  |  |
| `notes.retry` | Try again | ניסיון חוזר |  |  |
| `notes.work` | Work | פרויקטים |  |  |
| `notes.notFound` | Not found | לא נמצא |  |  |
| `notes.writtenInEnglish` | Written in English | כתוב באנגלית |  |  |
| `notes.authorRole` | Full-stack engineer & team lead | מהנדס פול־סטאק וראש צוות טכני |  |  |
| `projects.source` | Source | קוד מקור |  |  |
| `projects.decisions` | Decisions worth defending | החלטות שאני עומד מאחוריהן |  |  |
| `projects.skipWork` | Skip past the work | דילוג על הפרויקטים |  |  |
| `projects.builtWith` | Built with | נבנה עם |  |  |
| `projects.noYear` | Year not recorded | השנה לא נרשמה |  |  |
| `projects.stack` | Stack | טכנולוגיות |  |  |
| `projects.opensFor(…)` | for 3 (opens in a new tab) | של 3 (נפתח בלשונית חדשה) |  |  |
| `projects.worthKnowing` | Worth knowing | כדאי לדעת |  |  |
| `projects.elsewhere` | Elsewhere | ברשת |  |  |
| `projects.notFound` | Not found | לא נמצא |  |  |
| `filters.any` | Any | הכול |  |  |
| `filters.chosen(…)` | 3 chosen | 3 נבחרו |  |  |
| `filters.active` | Active filters | מסננים פעילים |  |  |
| `filters.remove` | , remove this filter | , הסרת המסנן |  |  |
| `filters.clearAll` | Clear all | ניקוי הכול |  |  |
| `filters.filter` | Filter | סינון |  |  |
| `filters.filterOn(…)` | Filter, 3 on | סינון, 3 פעילים |  |  |
| `filters.close` | Close | סגירה |  |  |
| `filters.of` | of | מתוך |  |  |
| `story.eyebrow` | Journey | מסלול מקצועי |  |  |
| `story.title` | The long way round | שלב אחר שלב |  | Approved in the owner's copy review. |
| `story.timeline` | Timeline | ציר זמן |  |  |
| `story.soFar` | So far | עד כה |  |  |
| `story.allWork` | All the work, without the years | כל הפרויקטים, בלי ציר הזמן |  |  |
| `story.figures.Anyone can open` | Anyone can open | פתוחים לכל אחד |  |  |
| `story.figures.In a store` | In a store | בחנויות האפליקציות |  |  |
| `story.figures.Years` | Years | שנים |  |  |
| `admin-shell.skip` | Skip to content | דילוג לתוכן |  |  |
| `admin-shell.admin` | admin | ניהול |  |  |
| `admin-shell.sections` | Admin sections | אזורי הניהול |  |  |
| `admin-shell.publicSite` | View public site | לאתר הציבורי |  |  |
| `admin-shell.signOut` | Sign out | התנתקות |  |  |
| `admin-shell.back` | Back | חזרה |  |  |
| `admin-shell.site` | Site | אתר |  |  |
| `accessibility-statement.eyebrow` | Statement | הצהרה |  |  |
| `accessibility-statement.title` | Accessibility | נגישות |  |  |
| `accessibility-statement.intro(…)` | This site aims to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA, which includes the Israeli standard IS 5568 (WCAG 2.0 at level AA). It was last audited on 3, by me, the site’s author. That audit is not a certification by an accessibility professional. | האתר שואף לעמוד בהנחיות הנגישות לתוכן אינטרנט (WCAG) 2.2 ברמה AA, הכוללות את התקן הישראלי ת״י 5568 (WCAG 2.0 ברמה AA). הבדיקה האחרונה נערכה ב־3, על ידיי, כותב האתר. הבדיקה הזאת אינה אישור של מורשה נגישות. |  |  |
| `accessibility-statement.inPlace` | What is in place | מה כבר קיים |  |  |
| `accessibility-statement.inPlaceItems.0` | Every page works with a keyboard alone. The first key press reaches a link that skips straight to the content, and focus is always visible. | כל עמוד עובד עם מקלדת בלבד. הלחיצה הראשונה מגיעה לקישור שמדלג ישירות לתוכן, והמיקוד תמיד גלוי. |  |  |
| `accessibility-statement.inPlaceItems.1` | Pages are built from headings and landmarks a screen reader can move between, and every image that carries meaning has a text description. | העמודים בנויים מכותרות ומאזורים שקורא מסך יכול לעבור ביניהם, ולכל תמונה שנושאת משמעות יש תיאור טקסטואלי. |  |  |
| `accessibility-statement.inPlaceItems.2` | Text and controls are measured for contrast against the ground they sit on, including the one dark section. | הניגודיות של טקסט ושל פקדים נמדדת מול הרקע שעליו הם מונחים, כולל האזור הכהה היחיד. |  |  |
| `accessibility-statement.inPlaceItems.3` | The layout holds at 320 pixels wide and at 400% zoom without scrolling sideways, and survives a reader’s own line, letter and word spacing. | הפריסה נשמרת ברוחב 320 פיקסלים ובהגדלה של 400% בלי גלילה הצידה, ועומדת בריווח שורות, אותיות ומילים שהקורא מגדיר בעצמו. |  |  |
| `accessibility-statement.inPlaceItems.4` | The contact form names every field, says which one needs a change and what the change is, and announces whether the message was sent. | טופס יצירת הקשר נותן שם לכל שדה, אומר איזה שדה צריך תיקון ומה התיקון, ומודיע אם ההודעה נשלחה. |  |  |
| `accessibility-statement.inPlaceItems.5` | The site is in English and Hebrew. The Hebrew pages are laid out right to left, and anything not yet translated is marked as English, so a screen reader reads it in the right voice. | האתר זמין באנגלית ובעברית. העמודים בעברית פרוסים מימין לשמאל, וכל מה שעדיין לא תורגם מסומן כאנגלית, כדי שקורא מסך יקרא אותו בקול הנכון. |  |  |
| `accessibility-statement.motion` | Motion, and the Pause button | תנועה, וכפתור ההשהיה |  |  |
| `accessibility-statement.motionBody` | Parts of the site move, and they move with your scrolling: as a section comes up it settles a few pixels into place and a small circle draws itself by its heading, and both undo on the way back up. Nothing is ever drawn over the text as it arrives. Apart from a short curtain over the window while a page first loads, and replies to what you click, tap or point at, nothing moves on its own. There are two ways to stop all of it. | חלקים מהאתר זזים, והם זזים עם הגלילה: כשאזור עולה הוא מתיישב כמה פיקסלים למקומו ועיגול קטן מצייר את עצמו ליד הכותרת שלו, ושניהם מתבטלים בדרך חזרה למעלה. שום דבר לא מצויר מעל הטקסט כשהוא מגיע. מלבד מסך קצר שמכסה את החלון בזמן שעמוד נטען לראשונה, ותגובות למה שלוחצים, מקישים או מצביעים עליו, שום דבר לא זז מעצמו. יש שתי דרכים לעצור את כל זה. |  |  |
| `accessibility-statement.reduceMotion` | If your device is set to reduce motion, the site already honours it and nothing animates. | אם המכשיר מוגדר להפחתת תנועה, האתר כבר מכבד את ההגדרה ושום דבר לא מונפש. |  |  |
| `accessibility-statement.pauseBefore` | Otherwise, the | אחרת, כפתור |  |  |
| `accessibility-statement.pauseName` | Pause motion | השהיית תנועה |  |  |
| `accessibility-statement.pauseAfter` | button in the top bar (inside the menu on a phone) stops every animation on every page, and the site remembers the choice on this device. Press it again to let things move. | בסרגל העליון (בתוך התפריט בטלפון) משהה כל הנפשה בכל עמוד, והאתר זוכר את הבחירה במכשיר הזה. לחיצה נוספת מחזירה את התנועה. |  |  |
| `accessibility-statement.noFlash` | Nothing on the site flashes, and no content is only available while it moves. | שום דבר באתר לא מהבהב, ואין תוכן שזמין רק בזמן שהוא זז. |  |  |
| `accessibility-statement.looks` | Changing how the site looks | שינוי המראה של האתר |  |  |
| `accessibility-statement.looksBody` | The theme button in the top bar (inside the menu on a phone) opens one menu with three settings. The site remembers each one on this device, and each can be reached and changed with the keyboard: Enter or Space opens the menu, the arrow keys move, and Escape closes it. | כפתור ערכת הצבעים בסרגל העליון (בתוך התפריט בטלפון) פותח תפריט אחד עם שלוש הגדרות. האתר זוכר כל אחת מהן במכשיר הזה, ואפשר להגיע לכל אחת ולשנות אותה במקלדת: Enter או רווח פותחים את התפריט, מקשי החיצים עוברים בין האפשרויות, ו־Escape סוגר אותו. |  |  |
| `accessibility-statement.looksItems.0.0` | Theme: | ערכת צבעים: |  |  |
| `accessibility-statement.looksItems.0.1` | Light, Dark, or System to follow your device. | בהירה, כהה, או לפי המערכת כדי לעקוב אחרי המכשיר שלכם. |  |  |
| `accessibility-statement.looksItems.1.0` | Text size: | גודל טקסט: |  |  |
| `accessibility-statement.looksItems.1.1` | Default, Large (about 12% bigger) or Larger (25% bigger). This is on top of your browser’s own zoom, which works as well. | רגיל, גדול (גדול בכ־12%) או גדול יותר (גדול ב־25%). זה בנוסף להגדלת התצוגה בדפדפן, שעובדת גם היא. |  |  |
| `accessibility-statement.looksItems.2.0` | Contrast: | ניגודיות: |  |  |
| `accessibility-statement.looksItems.2.1` | Standard, More, or System to follow your device’s "increase contrast" setting. More darkens the secondary text, the outlines and the dividers, and thickens the focus ring. | רגילה, מוגברת, או לפי המערכת כדי לעקוב אחרי הגדרת "הגברת ניגודיות" של המכשיר. מוגברת מכהה את הטקסט המשני, את קווי המתאר ואת קווי ההפרדה, ומעבה את טבעת המיקוד. |  |  |
| `accessibility-statement.limits` | Known limitations | מגבלות ידועות |  |  |
| `accessibility-statement.limitItems.0` | Some content, notes and project write-ups among it, is not yet translated into Hebrew. On a Hebrew page it is shown in English and marked as such. | חלק מהתוכן, ובכלל זה רשימות ותיאורי פרויקטים, עדיין לא תורגם לעברית. בעמוד בעברית הוא מוצג באנגלית ומסומן ככזה. |  |  |
| `accessibility-statement.limitItems.1` | Wide tables inside notes scroll sideways on a narrow screen. They can be reached and scrolled with the keyboard. | טבלאות רחבות בתוך רשימות נגללות הצידה במסך צר. אפשר להגיע אליהן ולגלול אותן במקלדת. |  |  |
| `accessibility-statement.limitItems.2` | The audit was checked with automated tools, a keyboard and the browser’s accessibility tree. It has not yet been checked with a screen reader on every platform. | הבדיקה נעשתה בכלים אוטומטיים, במקלדת ובעץ הנגישות של הדפדפן. האתר עדיין לא נבדק עם קורא מסך בכל הפלטפורמות. |  |  |
| `accessibility-statement.report` | Reporting a problem | דיווח על בעיה |  |  |
| `accessibility-statement.reportBefore` | If something here does not work for you, or you need it in another form, write to | אם משהו כאן לא עובד בשבילכם, או שאתם צריכים אותו בצורה אחרת, כתבו אל |  |  |
| `accessibility-statement.reportOr` | or use the | או השתמשו ב |  |  |
| `accessibility-statement.reportForm` | contact form | טופס יצירת הקשר |  |  |
| `accessibility-statement.reportAfter` | . Say which page and what happened; I will answer, and fix what can be fixed, as soon as I can. | . ציינו באיזה עמוד ומה קרה; אענה, ואתקן את מה שאפשר לתקן, מהר ככל שאוכל. |  |  |
| `accessibility-statement.updated(…)` | Statement last updated 3. | ההצהרה עודכנה לאחרונה ב־3. |  |  |
| `mcp.eyebrow` | Developers | למפתחים |  |  |
| `mcp.title` | MCP server | שרת MCP |  |  |
| `mcp.intro` | This site speaks the Model Context Protocol. Point Claude, or any MCP client, at it and it can read the posts, the project areas and the channel log. There is nothing to download and no key to copy, and reading needs no account. | האתר תומך ב־Model Context Protocol (MCP). חברו אליו את Claude, או כל לקוח MCP אחר, והוא יוכל לקרוא את הרשימות, את תחומי הפרויקטים ואת יומן הפעילות. אין מה להוריד ואין מפתח להעתיק, והקריאה לא דורשת חשבון. |  |  |
| `mcp.checking` | Checking the server… | בודק את השרת… |  |  |
| `mcp.status` | Status: | מצב: |  |  |
| `mcp.live` | live | פעיל |  |  |
| `mcp.off` | Status: not switched on yet. The commands below will work once it is. | מצב: עדיין לא הופעל. הפקודות שלמטה יעבדו ברגע שיופעל. |  |  |
| `mcp.connect` | Connect and read | חיבור וקריאה |  |  |
| `mcp.connectIntro` | Anyone can connect. This address needs no account, no sign-in and no key, and it carries only what the public site already shows: published posts, areas, tags and the channel log. Nothing here can write. | כל אחד יכול להתחבר. הכתובת הזאת לא דורשת חשבון, התחברות או מפתח, והיא מציעה רק את מה שהאתר הציבורי כבר מציג: רשימות שפורסמו, תחומים, תגיות ויומן הפעילות. אי אפשר לכתוב דרכה דבר. |  |  |
| `mcp.desktop` | claude.ai and Claude Desktop: Settings → Connectors → Add custom connector | ב־claude.ai וב־Claude Desktop: Settings → Connectors → Add custom connector |  | Claude's menu names kept in English, isolated so the path reads left to right. |
| `mcp.ownerHead` | Owner access | גישת בעל האתר |  |  |
| `mcp.ownerIntro` | The site’s owner has a second address. It asks for a GitHub sign-in, which opens a browser window; only the owner’s account is accepted, and any other account is told so and given nothing. In return it unlocks drafts, the audit log, media and translations, and, if the owner allows it, writes. | לבעל האתר יש כתובת שנייה. היא מבקשת התחברות עם GitHub, שפותחת חלון דפדפן; רק החשבון של בעל האתר מתקבל, וכל חשבון אחר מקבל הודעה על כך ולא מקבל דבר. בתמורה היא פותחת טיוטות, יומן ביקורת, מדיה ותרגומים, ואם בעל האתר מאשר, גם כתיבה. |  |  |
| `mcp.tools` | Tools | כלים |  |  |
| `mcp.publicHead` | Public, no sign-in | ציבוריים, בלי התחברות |  |  |
| `mcp.readHead` | Owner, read access (mcp:read) | בעל האתר, גישת קריאה (mcp:read) |  |  |
| `mcp.writeHead` | Owner, write access (mcp:write) | בעל האתר, גישת כתיבה (mcp:write) |  |  |
| `mcp.publicCaption` | Public tools | כלים ציבוריים |  |  |
| `mcp.readCaption` | Owner read tools | כלי קריאה של בעל האתר |  |  |
| `mcp.writeCaption` | Owner write tools | כלי כתיבה של בעל האתר |  |  |
| `mcp.tool` | Tool | כלי |  |  |
| `mcp.does` | What it does | מה הוא עושה |  |  |
| `mcp.copy` | Copy | העתקה |  |  |
| `mcp.copied` | Copied | הועתק |  |  |
| `mcp.copiedSay` | Copied to the clipboard | הועתק ללוח |  |  |
| `mcp.copyLabel(…)` | Copy: 3 | העתקה: 3 |  |  |
| `mcp.how` | How the owner’s sign-in works | איך עובדת ההתחברות של בעל האתר |  |  |
| `mcp.howBefore` | Standard OAuth 2.1 with PKCE. The client discovers everything from | OAuth 2.1 סטנדרטי עם PKCE. הלקוח מגלה את כל מה שהוא צריך מ־ |  |  |
| `mcp.howAfter` | and registers itself. | ונרשם בעצמו. |  |  |
| `mcp.howItems.0` | Identity comes from GitHub. The site never sees a password and keeps no GitHub token. | הזהות מגיעה מ־GitHub. האתר אף פעם לא רואה סיסמה ולא שומר אסימון של GitHub. |  |  |
| `mcp.howItems.1` | The owner chooses the access on a consent screen: read, or read and write. Writes are dry runs unless the tool is told otherwise, deletes need explicit confirmation, and every change is in the audit log under the client’s name. | בעל האתר בוחר את הגישה במסך הסכמה: קריאה, או קריאה וכתיבה. פעולות כתיבה מתבצעות כהרצה יבשה אלא אם הכלי מתבקש אחרת, מחיקות דורשות אישור מפורש, וכל שינוי נרשם ביומן הביקורת בשם הלקוח. |  |  |
| `mcp.howItems.2` | Access tokens last an hour and renew for up to 30 days of use. Any connection can be revoked from the site’s admin at once. | אסימוני גישה תקפים לשעה ומתחדשים עד 30 ימי שימוש. אפשר לבטל כל חיבור מממשק הניהול של האתר באופן מיידי. |  |  |
| `mcp.toolsDo.list_posts` | Published posts, newest first; filter by tag or area. | רשימות שפורסמו, מהחדשה לישנה; סינון לפי תגית או תחום. |  |  |
| `mcp.toolsDo.get_post` | One published post, in full. | רשימה אחת שפורסמה, במלואה. |  |  |
| `mcp.toolsDo.list_tags` | Tags on published posts, with counts. | התגיות של רשימות שפורסמו, עם הספירה שלהן. |  |  |
| `mcp.toolsDo.list_areas` | The site's areas: its own notes and each project. | התחומים של האתר: הרשימות שלו עצמו וכל פרויקט. |  |  |
| `mcp.toolsDo.get_area` | One area, with its links and repository. | תחום אחד, עם הקישורים והמאגר שלו. |  |  |
| `mcp.toolsDo.list_activity` | The channel log: posts, releases and pushes. | יומן הפעילות: רשימות, גרסאות ועדכוני קוד. |  |  |
| `mcp.toolsDo.admin_list_posts` | Every post, drafts and archived included. | כל הרשימות, כולל טיוטות וארכיון. |  |  |
| `mcp.toolsDo.admin_get_post` | Any post, in full. | כל רשימה, במלואה. |  |  |
| `mcp.toolsDo.read_audit_log` | Who changed what, and through which client. | מי שינה מה, ודרך איזה לקוח. |  |  |
| `mcp.toolsDo.list_media` | The media library: pictures, icons and videos, with what uses each. | ספריית המדיה: תמונות, סמלים וסרטונים, ומה משתמש בכל אחד. |  |  |
| `mcp.toolsDo.save_post_draft` | Create or edit a post. Dry run unless told otherwise. | יצירה או עריכה של רשימה. הרצה יבשה אלא אם מתבקש אחרת. |  |  |
| `mcp.toolsDo.publish_post` | Publish a post. Dry run unless told otherwise. | פרסום רשימה. הרצה יבשה אלא אם מתבקש אחרת. |  |  |
| `mcp.toolsDo.unpublish_post` | Return a post to draft. Dry run unless told otherwise. | החזרת רשימה לטיוטה. הרצה יבשה אלא אם מתבקש אחרת. |  |  |
| `mcp.toolsDo.delete_post` | Archive a post. Needs confirm: true. | העברת רשימה לארכיון. דורש confirm: true. |  |  |
| `mcp.toolsDo.save_area` | Create or edit an area. Dry run unless told otherwise. | יצירה או עריכה של תחום. הרצה יבשה אלא אם מתבקש אחרת. |  |  |
| `mcp.toolsDo.delete_area` | Hide an area. Needs confirm: true. | הסתרת תחום. דורש confirm: true. |  |  |
| `admin-settings.title` | Settings | הגדרות |  |  |
| `admin-settings.intro` | What comes before what on the home page, what is shown, and the defaults a visitor gets before choosing their own. Every save is kept below and can be put back. | מה בא לפני מה בדף הבית, מה מוצג, וברירות המחדל שמבקר מקבל לפני שבחר בעצמו. כל גרסה שמורה למטה וניתן לשחזר אותה. |  |  |
| `admin-settings.homeHeading` | Home page | דף הבית |  |  |
| `admin-settings.homeHint` | The hero is always first. The sections after it, in order: | הפתיח תמיד ראשון. האזורים שאחריו, לפי הסדר: |  |  |
| `admin-settings.hero` | Hero, always first | פתיח, תמיד ראשון |  |  |
| `admin-settings.sections.work` | Work (dark) | פרויקטים (כהה) |  |  |
| `admin-settings.sections.approach` | How I work | איך אני עובד |  |  |
| `admin-settings.sections.city` | The year (dark) | השנה האחרונה (כהה) |  |  |
| `admin-settings.sections.notes` | Notes | רשימות |  |  |
| `admin-settings.sections.stack` | Specs | במספרים |  |  |
| `admin-settings.sections.contact` | Contact | יצירת קשר |  |  |
| `admin-settings.shown` | Shown | מוצג |  |  |
| `admin-settings.hidden` | Hidden | מוסתר |  |  |
| `admin-settings.show(…)` | Show 3 | הצגת 3 |  |  |
| `admin-settings.moveUp(…)` | Move 3 up | הזזת 3 למעלה |  |  |
| `admin-settings.moveDown(…)` | Move 3 down | הזזת 3 למטה |  |  |
| `admin-settings.visualsHeading` | Visuals | מראה |  |  |
| `admin-settings.themeLegend` | Default theme | ערכת צבעים כברירת מחדל |  |  |
| `admin-settings.themeHint` | For a visitor who has not chosen. Their own choice always wins. | למבקר שעוד לא בחר. הבחירה שלו תמיד קובעת. |  |  |
| `admin-settings.themes.light` | Light | בהירה |  |  |
| `admin-settings.themes.dark` | Dark | כהה |  |  |
| `admin-settings.themes.system` | Follow the device | לפי המכשיר |  |  |
| `admin-settings.motionLegend` | Default motion | תנועה כברירת מחדל |  |  |
| `admin-settings.motionHint` | Pausing is a default only. A visitor's device setting for less motion always applies. | השהיה היא ברירת מחדל בלבד. הגדרת המכשיר של המבקר להפחתת תנועה תמיד חלה. |  |  |
| `admin-settings.motions.on` | Moving | בתנועה |  |  |
| `admin-settings.motions.paused` | Paused | מושהית |  |  |
| `admin-settings.accentLegend` | Accent | צבע הדגשה |  |  |
| `admin-settings.accentHint` | Each preset is checked for readable contrast in both themes. | כל אפשרות נבדקה לניגודיות קריאה בשתי הערכות. |  |  |
| `admin-settings.accents.ink` | Ink blue | כחול דיו |  |  |
| `admin-settings.accents.pine` | Pine | ירוק אורן |  |  |
| `admin-settings.accents.plum` | Plum | שזיף |  |  |
| `admin-settings.accents.rust` | Rust | חלודה |  |  |
| `admin-settings.save` | Save | שמירה |  |  |
| `admin-settings.saving` | Saving… | שומר… |  |  |
| `admin-settings.saved` | Saved | נשמר |  |  |
| `admin-settings.reset` | Undo changes | ביטול השינויים |  |  |
| `admin-settings.loading` | Loading… | טוען… |  |  |
| `admin-settings.loadFailed` | The settings could not be loaded. The site is showing its defaults. | לא ניתן לטעון את ההגדרות. האתר מציג את ברירות המחדל. |  |  |
| `admin-settings.notAuthorised` | Sign in to the admin to change the settings. | יש להתחבר לניהול כדי לשנות את ההגדרות. |  |  |
| `admin-settings.conflict` | These changed elsewhere. Reload to see the newer version. | ההגדרות שונו במקום אחר. יש לטעון מחדש כדי לראות את הגרסה החדשה. |  |  |
| `admin-settings.reload` | Reload | טעינה מחדש |  |  |
| `admin-settings.unsaved` | Unsaved changes | שינויים שלא נשמרו |  |  |
| `admin-settings.version(…)` | Version 3 | גרסה 3 |  |  |
| `admin-settings.builtIn` | Built-in defaults | ברירות המחדל המובנות |  |  |
| `admin-settings.current` | Current | נוכחית |  |  |
| `admin-settings.historyHeading` | History | היסטוריה |  |  |
| `admin-settings.historyEmpty` | Nothing saved yet. The site is using its built-in defaults. | עוד לא נשמר דבר. האתר משתמש בברירות המחדל המובנות. |  |  |
| `admin-settings.restore` | Put back | שחזור |  |  |
| `admin-settings.restoreLabel(…)` | Put back 3 | שחזור 3 |  |  |
| `admin-settings.differences(…)` | 3 differences from now | 3 הבדלים מהגרסה הנוכחית |  |  |
| `admin-settings.issues.settings.ledger.darkAdjacent` | Work and The year are both on the dark ground; shown next to each other they read as one section. Put a section between them or hide one. | הפרויקטים והשנה שניהם על הרקע הכהה; כשהם מוצגים זה ליד זה הם נקראים כאזור אחד. יש לשים אזור ביניהם או להסתיר אחד מהם. |  |  |
| `admin-settings.issues.settings.sections.duplicate` | A section is listed twice. | אזור מופיע פעמיים. |  |  |
| `admin-settings.issues.settings.sections.missing` | Every section must be listed once. | כל אזור צריך להופיע פעם אחת. |  |  |
| `admin-settings.genericIssue` | This value is not allowed. | הערך אינו תקין. |  |  |
| `reader.contents` | Contents | תוכן העניינים |  |  |
| `reader.onThisPage` | On this page | בעמוד הזה |  |  |
| `reader.details` | About this note | על הרשימה |  |  |
| `reader.contentsAndDetails` | Contents and details | תוכן העניינים ופרטים |  |  |
| `reader.close` | Close | סגירה |  |  |
| `reader.area` | Area | תחום |  |  |
| `reader.published` | Published | פורסם |  |  |
| `reader.updated` | Updated | עודכן |  |  |
| `reader.updatedTitle(…)` | Updated 3 | עודכן 3 |  |  |
| `reader.whatChanged` | What changed | מה השתנה |  |  |
| `reader.readTime(…)` | 3 min read | 3 דקות קריאה |  |  |
| `reader.tags` | Tags | תגיות |  |  |
| `reader.share` | Share | שיתוף |  |  |
| `reader.linkCopied` | Link copied | הקישור הועתק |  |  |
| `reader.edit` | Edit | עריכה |  |  |
| `reader.editNote` | Edit this note | עריכת הרשימה |  |  |
| `reader.reading` | Reading | קריאה |  |  |
| `reader.textSize` | Text size | גודל טקסט |  |  |
| `reader.smaller` | Smaller text | טקסט קטן יותר |  |  |
| `reader.larger` | Larger text | טקסט גדול יותר |  |  |
| `reader.width` | Line length | אורך שורה |  |  |
| `reader.narrow` | Narrow | צר |  |  |
| `reader.wide` | Wide | רחב |  |  |
| `reader.reset` | Reset | איפוס |  |  |
| `reader.sizeNow(…)` | Text at 3 | גודל טקסט: 3 |  |  |
| `reader.picture` | Picture | תמונה |  |  |
| `reader.diagram` | Diagram | תרשים |  |  |
| `reader.openPicture(…)` | Open the picture: 3 | פתיחת התמונה: 3 |  |  |
| `reader.openDiagram(…)` | Open the diagram: 3 | פתיחת התרשים: 3 |  |  |
| `reader.viewer` | Picture view | תצוגת תמונה |  |  |
| `reader.zoomIn` | Zoom in | הגדלה |  |  |
| `reader.zoomOut` | Zoom out | הקטנה |  |  |
| `reader.zoomReset` | Fit to screen | התאמה למסך |  |  |
| `reader.zoomLevel(…)` | Zoom 3 | זום 3 |  |  |
| `reader.previous` | Previous picture | התמונה הקודמת |  |  |
| `reader.next` | Next picture | התמונה הבאה |  |  |
| `reader.ofCount(…)` | 3 of X | 3 מתוך X |  |  |
| `reader.viewerHint` | Arrow keys move between pictures, + and − zoom, drag to pan, Escape closes. | החצים עוברים בין תמונות, + ו־− מגדילים ומקטינים, גרירה מזיזה, Escape סוגר. |  |  |
| `reader.copyCode` | Copy the code | העתקת הקוד |  |  |
| `reader.codeCopied` | Code copied | הקוד הועתק |  |  |
| `reader.codeIn(…)` | Code, 3 | קוד, 3 |  |  |
| `reader.plain` | text | טקסט |  |  |
| `reader.table` | Table, scrolls sideways | טבלה, נגללת הצידה |  |  |
| `reader.external` | (opens on another site) | (נפתח באתר אחר) |  |  |
| `reader.kindNote` | Note | רשימה |  |  |
| `reader.kindArea` | Area | תחום |  |  |
| `reader.kindProject` | Project | פרויקט |  |  |
| `reader.missingLink` | No note by that name yet | עדיין אין רשימה בשם הזה |  |  |
| `reader.back` | Blogs | בלוג |  |  |
| `reader.note` | Note | רשימה |  |  |
| `reader.work` | Work | פרויקטים |  |  |
| `reader.loading` | Loading the post | הרשימה נטענת… |  |  |
| `reader.notHere` | Not here | הרשימה לא נמצאה |  |  |
| `reader.notHereBody` | That post doesn’t exist, or isn’t published yet. The address may have changed when the notes moved from /notes to /blog. | הרשימה הזאת לא קיימת, או שעדיין לא פורסמה. ייתכן שהכתובת השתנתה כשהרשימות עברו מ־/notes ל־/blog. |  |  |
| `reader.unavailable` | Post unavailable | הרשימה לא זמינה |  |  |
| `reader.noAnswer` | The server didn’t answer. | השרת לא ענה. |  |  |
| `reader.noAnswerBody` | The page loaded; the post behind it didn’t. It is served by a small machine I run myself, so this is usually a restart rather than anything permanent. | העמוד נטען; הרשימה שמאחוריו לא. היא מוגשת משרת קטן שאני מפעיל בעצמי, ולרוב מדובר בהפעלה מחדש ולא בתקלה קבועה. |  |  |
| `reader.tryAgain` | Try again | ניסיון חוזר |  |  |
| `dashboard.role` | Technical team lead | ראש צוות טכני |  |  |
| `dashboard.views` | Views | תצוגות |  |  |
| `dashboard.home` | Home | בית |  |  |
| `dashboard.feed` | Feed | פיד |  |  |
| `dashboard.topAreas` | Top areas | תחומים מובילים |  |  |
| `dashboard.findArea` | Find an area | חיפוש תחום |  |  |
| `dashboard.showMore` | Show more | הצגת עוד |  |  |
| `dashboard.showLess` | Show less | הצגת פחות |  |  |
| `dashboard.noAreaMatch` | No area matches. | אין תחום כזה. |  |  |
| `dashboard.filter` | Filter | סינון |  |  |
| `dashboard.browse` | Browse | עיון |  |  |
| `dashboard.close` | Close | סגירה |  |  |
| `dashboard.backTo` | Back to the notes | חזרה לרשימות |  |  |
| `dashboard.askLabel` | Search the notes | חיפוש ברשימות |  |  |
| `dashboard.askPlaceholder` | Search notes, # for a topic, @ for an area… | חיפוש רשימות, # לנושא, @ לתחום… |  |  |
| `dashboard.askSubmit` | Search | חיפוש |  |  |
| `dashboard.searchPlaceholder` | Title, topic or phrase… | כותרת, נושא או ביטוי… |  |  |
| `dashboard.askHint` | # picks a topic, @ picks an area. Enter searches. | # בוחר נושא, @ בוחר תחום. Enter מחפש. |  |  |
| `dashboard.suggestions` | Suggestions | הצעות |  |  |
| `dashboard.quickTopics` | Topics | נושאים |  |  |
| `dashboard.topPosts` | Top posts | רשימות מומלצות |  |  |
| `dashboard.viewAll` | View all | לכל הרשימות |  |  |
| `dashboard.tree` | Browse by area | עיון לפי תחום |  |  |
| `dashboard.treeHint` | Arrow keys move, Right opens an area, Enter opens a note. | מקשי החיצים מנווטים, חץ שמאלה פותח תחום, Enter פותח רשימה. |  | In RTL the tree swaps the arrows, so Left opens an area (Tree.tsx). |
| `dashboard.latest` | Latest | אחרונות |  |  |
| `dashboard.everything` | Every note | כל הרשימות |  |  |
| `dashboard.timeline` | Latest on the site | חדש באתר |  |  |
| `dashboard.channelLog` | View full channel log | יומן הפעילות המלא |  |  |
| `dashboard.noEvents` | Nothing has happened on the site yet. | עוד לא קרה כלום באתר. |  |  |
| `dashboard.eventsFailed` | The activity couldn’t be loaded. | לא ניתן לטעון את הפעילות. |  |  |
| `dashboard.retry` | Try again | ניסיון חוזר |  |  |
| `dashboard.notesFailedTitle` | The notes couldn’t be loaded. | לא ניתן לטעון את הרשימות. |  |  |
| `dashboard.notesFailedBody` | The writing is served by a small machine I run myself, and it isn’t answering right now. Usually that means a restart. | הרשימות מוגשות משרת קטן שאני מפעיל בעצמי, והשרת לא עונה כרגע. לרוב מדובר בהפעלה מחדש ולא בתקלה קבועה. |  |  |
| `dashboard.seeProjects` | See the projects | לפרויקטים |  |  |
| `dashboard.emptyTitle` | Nothing published yet. | עוד לא פורסם כלום. |  |  |
| `dashboard.emptyBody` | The notes go up as the work gets done. The projects are further along. | הרשימות עולות ככל שהעבודה מתקדמת. בעמוד הפרויקטים יש כבר הרבה יותר. |  |  |
| `dashboard.noMatch` | No note matches these filters. | אין רשימה שמתאימה לסינון. |  |  |
| `dashboard.clearFilters` | Clear the filters | ניקוי הסינון |  |  |
| `dashboard.sparse` | That’s every note so far. | אלה כל הרשימות עד עכשיו. |  |  |
| `dashboard.showMoreNotes` | Show more notes | עוד רשימות |  |  |
| `dashboard.minRead(…)` | 3 min read | 3 דק׳ קריאה |  |  |
| `dashboard.notes(…)` | 3 notes | 3 רשימות |  |  |
| `dashboard.ofNotes(…)` | 3 of X notes | 3 מתוך X רשימות |  |  |
| `dashboard.featured` | Featured | מומלצת |  |  |
| `dashboard.kind.post` | New note | רשימה חדשה |  |  |
| `dashboard.kind.release` | Release | גרסה |  |  |
| `dashboard.kind.push` | Pushed | עדכוני קוד |  |  |
| `dashboard.kind.site` | Site release | גרסת אתר |  |  |
| `dashboard.kind.area` | New area | תחום חדש |  |  |
| `dashboard.areaPage` | Area | תחום |  |  |
| `dashboard.areaInterim` | The full area history arrives with its own page; until then, every note filed here, newest first. | ההיסטוריה המלאה של התחום תגיע בעמוד משלה; עד אז, כל הרשימות שתויקו כאן, מהחדשה לישנה. |  |  |
| `dashboard.areaMissing` | There is no area by that name. | אין תחום בשם הזה. |  |  |
| `dashboard.goToProject` | Go to the project | לפרויקט |  |  |
| `work.title` | Work | פרויקטים |  |  |
| `work.lede` | Everything I’ve built, pinned first. Open a project for the decisions behind it, its notes, its releases and its docs. | כל מה שבניתי, כשהמוצמדים בראש. פתחו פרויקט כדי לראות את ההחלטות שמאחוריו, את הרשימות, הגרסאות והתיעוד שלו. |  |  |
| `work.browse` | Browse the work | עיון בפרויקטים |  |  |
| `work.pinned` | Pinned | מוצמדים |  |  |
| `work.pinnedHint` | In use now | בשימוש עכשיו |  |  |
| `work.projects` | Projects | פרויקטים |  |  |
| `work.areas` | Areas with notes | תחומים עם רשימות |  |  |
| `work.findArea` | Find an area | חיפוש תחום |  |  |
| `work.sortBy` | Sort by | מיון לפי |  |  |
| `work.sort.updated` | Recently updated | עודכנו לאחרונה |  |  |
| `work.sort.newest` | Newest | החדשים |  |  |
| `work.sort.name` | Name | שם |  |  |
| `work.releases` | Latest releases | גרסאות אחרונות |  |  |
| `work.noReleases` | No project has published a release yet. | אף פרויקט עוד לא פרסם גרסה. |  |  |
| `work.updated(…)` | Updated 3 | עודכן 3 |  |  |
| `work.notesLink` | Notes | רשימות |  |  |
| `work.notesLinkFor(…)` | Notes on 3 | רשימות על 3 |  |  |
| `work.stars(…)` | 3 stars | 3 כוכבים |  |  |
| `work.forks(…)` | 3 forks | 3 פיצולים |  |  |
| `work.release` | Latest release | גרסה אחרונה |  |  |
| `work.strip` | Recent pushes and releases | עדכוני קוד וגרסאות אחרונים |  |  |
| `work.stripEmpty` | No pushes or releases in the last year | אין עדכוני קוד או גרסאות בשנה האחרונה |  |  |
| `work.pushed` | Pushed | עדכוני קוד |  |  |
| `work.released(…)` | Released 3 | גרסה 3 |  |  |
| `work.ofProjects(…)` | 3 of X projects | 3 מתוך X פרויקטים |  |  |
| `work.noMatch` | No project matches these filters. | אין פרויקט שמתאים לסינון. |  |  |
| `work.noMatchBody` | Take a filter off, or start again from the whole list. | הסירו מסנן, או התחילו מחדש מהרשימה המלאה. |  |  |
| `work.clear` | Show every project | כל הפרויקטים |  |  |
| `work.liveFailed` | The live index isn’t answering, so stars, pushes and releases may be missing. Every project is still listed. | הנתונים העדכניים מ־GitHub לא זמינים כרגע, ולכן ייתכן שחסרים כוכבים, עדכוני קוד וגרסאות. כל הפרויקטים עדיין מופיעים. |  |  |
| `work.noun(…)` | projects | פרויקטים |  |  |
| `work.facet.state` | State | מצב |  |  |
| `work.facet.year` | Year | שנה |  |  |
| `work.facet.stack` | Stack | טכנולוגיה |  |  |
| `work.backToWork` | Work | פרויקטים |  |  |
| `work.tabs` | Project sections | חלקי הפרויקט |  |  |
| `work.tab.overview` | Overview | סקירה |  |  |
| `work.tab.notes` | Notes | רשימות |  |  |
| `work.tab.releases` | Releases | גרסאות |  |  |
| `work.tab.docs` | Docs | תיעוד |  |  |
| `work.areaHistory` | Open the area’s full history | להיסטוריה המלאה של התחום |  |  |
| `work.noNotes` | Nothing written about this one yet. | עוד לא נכתב כלום על הפרויקט הזה. |  |  |
| `work.noNotesLive` | Notes are filed by area, and this project’s area has none yet. | הרשימות מתויקות לפי תחום, ובתחום של הפרויקט הזה עוד אין. |  |  |
| `work.releasesFrom` | Releases, newest first, from the repository. | גרסאות מתוך המאגר, מהחדשה לישנה. |  |  |
| `work.noReleasesHere` | No releases published for this project. | לא פורסמו גרסאות לפרויקט הזה. |  |  |
| `work.releasesFailed` | The releases couldn’t be loaded. | לא ניתן לטעון את הגרסאות. |  |  |
| `work.noDocs` | No docs are published from this repository. | אין תיעוד שפורסם מהמאגר הזה. |  |  |
| `work.docsFrom` | Pages published from the repository’s own docs. | עמודים שמתפרסמים מתוך התיעוד של המאגר. |  |  |
| `work.retry` | Try again | ניסיון חוזר |  |  |
| `work.onGitHub` | View on GitHub | צפייה ב־GitHub |  |  |
| `work.latest` | Latest | אחרונה |  |  |
| `work.allWork` | All work | כל הפרויקטים |  |  |
| `work.projectNav` | Projects | פרויקטים |  |  |
| `work.about` | About | אודות |  |  |
| `work.source` | Source | קוד מקור |  |  |
| `work.areaNotes` | Notes in this area | רשימות בתחום הזה |  |  |
| `work.repository` | Repository | מאגר |  |  |
| `work.feed` | The area’s RSS feed | פיד RSS של התחום |  |  |
| `work.releasesOnGitHub` | Releases on GitHub | הגרסאות ב־GitHub |  |  |
| `work.loadingProject` | Loading project | הפרויקט נטען |  |  |
| `work.notHere` | Not here | הפרויקט לא נמצא |  |  |
| `work.notHereBody` | No project at that address. | אין פרויקט בכתובת הזאת. |  |  |
| `work.seeEverything` | See everything | לכל הפרויקטים |  |  |
| `note-editor.newNote` | New note | רשימה חדשה |  |  |
| `note-editor.loading` | Loading… | טוען… |  |  |
| `note-editor.title` | Title | כותרת |  |  |
| `note-editor.titlePlaceholder` | Every check must be able to fail | כל בדיקה צריכה להיות מסוגלת להיכשל |  |  |
| `note-editor.body` | Body | גוף |  |  |
| `note-editor.bodyHelp` | Markdown. Paste or drop a picture to upload it. Type [[ to link a note, an area or a project. | Markdown. הדביקו או גררו תמונה כדי להעלות אותה. הקלידו [[ כדי לקשר לרשימה, לתחום או לפרויקט. |  |  |
| `note-editor.bodyPlaceholder` | ## A heading  Text, `code`, [[a-note]] and fenced blocks all work. | ## כותרת  טקסט, `קוד`, [[a-note]] ובלוקי קוד עובדים כולם. |  |  |
| `note-editor.bodyEnglish` | English | אנגלית |  |  |
| `note-editor.bodyHebrew` | Hebrew | עברית |  |  |
| `note-editor.write` | Write | כתיבה |  |  |
| `note-editor.preview` | Preview | תצוגה מקדימה |  |  |
| `note-editor.previewLabel` | Preview, as a reader sees it | תצוגה מקדימה, כפי שקורא רואה |  |  |
| `note-editor.nothingYet` | Nothing written yet. | עוד לא נכתב דבר. |  |  |
| `note-editor.toolbar` | Formatting | עיצוב |  |  |
| `note-editor.tools.h2` | Heading | כותרת |  |  |
| `note-editor.tools.h3` | Subheading | כותרת משנה |  |  |
| `note-editor.tools.bold` | Bold | מודגש |  |  |
| `note-editor.tools.italic` | Italic | נטוי |  |  |
| `note-editor.tools.strike` | Strikethrough | קו חוצה |  |  |
| `note-editor.tools.code` | Inline code | קוד בשורה |  |  |
| `note-editor.tools.link` | Link | קישור |  |  |
| `note-editor.tools.quote` | Quote | ציטוט |  |  |
| `note-editor.tools.ul` | Bulleted list | רשימת תבליטים |  |  |
| `note-editor.tools.ol` | Numbered list | רשימה ממוספרת |  |  |
| `note-editor.tools.task` | Checklist | רשימת משימות |  |  |
| `note-editor.tools.codeblock` | Code block | בלוק קוד |  |  |
| `note-editor.tools.wikilink` | Link a note, area or project | קישור לרשימה, תחום או פרויקט |  |  |
| `note-editor.tools.image` | Insert a picture from the library | הוספת תמונה מהספרייה |  |  |
| `note-editor.placeholderText` | text | טקסט |  |  |
| `note-editor.linkText` | link text | טקסט הקישור |  |  |
| `note-editor.uploading(…)` | Uploading 3… | מעלה את 3… |  |  |
| `note-editor.uploaded(…)` | 3 uploaded and inserted. | 3 הועלה ונוסף. |  |  |
| `note-editor.uploadFailed(…)` | 3 was not uploaded: X | 3 לא הועלה: X |  |  |
| `note-editor.suggestions` | Link suggestions | הצעות לקישור |  |  |
| `note-editor.noSuggestions` | Nothing matches | אין התאמות |  |  |
| `note-editor.kindNote` | Note | רשימה |  |  |
| `note-editor.kindArea` | Area | תחום |  |  |
| `note-editor.kindProject` | Project | פרויקט |  |  |
| `note-editor.details` | Details | פרטים |  |  |
| `note-editor.area` | Area | תחום |  |  |
| `note-editor.tags` | Tags | תגיות |  |  |
| `note-editor.tagsHelp` | Press Enter or comma to add a tag. Lower case, digits and dashes. | Enter או פסיק מוסיפים תגית. אותיות לטיניות קטנות, ספרות ומקפים. |  |  |
| `note-editor.addTag` | Add a tag | הוספת תגית |  |  |
| `note-editor.removeTag(…)` | Remove tag 3 | הסרת התגית 3 |  |  |
| `note-editor.featured` | Featured order | מיקום בין המומלצות |  |  |
| `note-editor.featuredHelp` | 1 comes first among the top notes. Leave empty to rank by date. | 1 מופיעה ראשונה בין הרשימות המומלצות. השאירו ריק כדי למיין לפי תאריך. |  |  |
| `note-editor.notFeatured` | Not featured | ללא קידום |  |  |
| `note-editor.cover` | Cover image | תמונת שער |  |  |
| `note-editor.coverHelp` | A full https:// address, or pick one from the library. | כתובת https:// מלאה, או בחירה מהספרייה. |  |  |
| `note-editor.publishDate` | Publish date | תאריך פרסום |  |  |
| `note-editor.publishDateHelp` | Leave empty to use the day you first publish. | השאירו ריק כדי להשתמש ביום הפרסום הראשון. |  |  |
| `note-editor.subtitle` | Subtitle | כותרת משנה |  |  |
| `note-editor.excerpt` | Excerpt | תקציר |  |  |
| `note-editor.excerptHelp(…)` | 3/320. Shown in the list and in search results. | 3/320. מוצג ברשימה ובתוצאות חיפוש. |  |  |
| `note-editor.seo` | Search and sharing | חיפוש ושיתוף |  |  |
| `note-editor.seoTitle` | Search title | כותרת לחיפוש |  |  |
| `note-editor.seoTitleHelp` | Leave empty to use the title. | השאירו ריק כדי להשתמש בכותרת. |  |  |
| `note-editor.seoDescription` | Search description | תיאור לחיפוש |  |  |
| `note-editor.seoDescriptionHelp` | Leave empty to use the excerpt. | השאירו ריק כדי להשתמש בתקציר. |  |  |
| `note-editor.canonical` | Canonical address | כתובת קנונית |  |  |
| `note-editor.canonicalHelp` | Only when this note was first published elsewhere. | רק אם הרשימה פורסמה קודם במקום אחר. |  |  |
| `note-editor.noindex` | Ask search engines not to index this note | בקשה ממנועי חיפוש לא לאנדקס את הרשימה |  |  |
| `note-editor.hebrew` | Hebrew | עברית |  |  |
| `note-editor.hebrewHelp` | The note in Hebrew. The body is edited above, under Hebrew. | הרשימה בעברית. את הגוף עורכים למעלה, תחת עברית. |  |  |
| `note-editor.advanced` | Advanced | מתקדם |  |  |
| `note-editor.slug` | Slug | מזהה כתובת |  |  |
| `note-editor.slugHelp` | The note's address. Changing it after publishing makes a new note and leaves the old address behind. | הכתובת של הרשימה. שינוי אחרי פרסום יוצר רשימה חדשה ומשאיר את הכתובת הישנה מאחור. |  |  |
| `note-editor.status.draft` | Draft | טיוטה |  |  |
| `note-editor.status.published` | Published | פורסם |  |  |
| `note-editor.status.archived` | Archived | בארכיון |  |  |
| `note-editor.unpublishedChanges` | Unpublished changes | שינויים שלא פורסמו |  |  |
| `note-editor.unpublishedSince(…)` | Unpublished changes, autosaved 3. Readers still see the published note. | שינויים שלא פורסמו, נשמרו אוטומטית 3. הקוראים עדיין רואים את הגרסה המפורסמת. |  |  |
| `note-editor.neverPublished` | Not published yet. Autosave keeps it private. | עוד לא פורסם. הטיוטה נשמרת אוטומטית ואינה גלויה לקוראים. |  |  |
| `note-editor.newNoteHint` | Choose the title and the address, then Save draft. Autosave takes over from there. | בחרו כותרת וכתובת, ואז שמירת טיוטה. מכאן השמירה האוטומטית ממשיכה. |  |  |
| `note-editor.slugLocked` | Fixed once the note is saved: a new address would make a new note. | קבוע מרגע שהרשימה נשמרה: כתובת חדשה הייתה יוצרת רשימה חדשה. |  |  |
| `note-editor.editingIn` | Editing | עריכה ב |  |  |
| `note-editor.autosaved(…)` | Draft saved 3 | הטיוטה נשמרה 3 |  |  |
| `note-editor.saving` | Saving draft… | שומר טיוטה… |  |  |
| `note-editor.unsaved` | Not saved yet | עוד לא נשמר |  |  |
| `note-editor.saveFailed(…)` | The draft was not saved: 3 | הטיוטה לא נשמרה: 3 |  |  |
| `note-editor.saveNow` | Save draft | שמירת טיוטה |  |  |
| `note-editor.review` | Review and publish | סקירה ופרסום |  |  |
| `note-editor.discard` | Discard changes | ביטול השינויים |  |  |
| `note-editor.discardConfirm` | Throw away the unpublished changes and go back to the published note? | לבטל את השינויים שלא פורסמו ולחזור לגרסה המפורסמת? |  |  |
| `note-editor.unpublish` | Move to drafts | החזרה לטיוטות |  |  |
| `note-editor.conflict` | This note was changed somewhere else after you opened it. | הרשימה שונתה במקום אחר אחרי שפתחתם אותה. |  |  |
| `note-editor.loadTheirs` | Load the other version | טעינת הגרסה האחרת |  |  |
| `note-editor.keepMine` | Keep mine | שמירת הגרסה שלי |  |  |
| `note-editor.leaveConfirm` | You have changes that are not saved yet. Leave anyway? | יש שינויים שעוד לא נשמרו. לצאת בכל זאת? |  |  |
| `note-editor.reviewTitle` | Review before publishing | סקירה לפני פרסום |  |  |
| `note-editor.firstPublish` | This is the first publish. Everything below goes live. | זה הפרסום הראשון. כל מה שלמטה יפורסם. |  |  |
| `note-editor.noChanges` | Nothing differs from the published note. | אין הבדל מהגרסה המפורסמת. |  |  |
| `note-editor.fieldsChanged` | Changed | השתנה |  |  |
| `note-editor.bodyChanges(…)` | Body: 3 lines added, X removed | גוף: 3 שורות נוספו, X הוסרו |  |  |
| `note-editor.tooLong` | The body is too long to compare line by line. | הגוף ארוך מכדי להשוות שורה בשורה. |  |  |
| `note-editor.skipped(…)` | 3 unchanged lines | 3 שורות שלא השתנו |  |  |
| `note-editor.added` | added | נוסף |  |  |
| `note-editor.removed` | removed | הוסר |  |  |
| `note-editor.whatChanged` | What changed | מה השתנה |  |  |
| `note-editor.whatChangedHelp` | One line for readers, beside the Updated date. Optional. | שורה אחת לקוראים, ליד תאריך העדכון. לא חובה. |  |  |
| `note-editor.publish` | Publish | פרסום |  |  |
| `note-editor.publishing` | Publishing… | מפרסם… |  |  |
| `note-editor.published` | Published. | פורסם. |  |  |
| `note-editor.cancel` | Cancel | ביטול |  |  |
| `note-editor.empty` | (empty) | (ריק) |  |  |
| `note-editor.fieldNames.title` | Title | כותרת |  |  |
| `note-editor.fieldNames.subtitle` | Subtitle | כותרת משנה |  |  |
| `note-editor.fieldNames.excerpt` | Excerpt | תקציר |  |  |
| `note-editor.fieldNames.tags` | Tags | תגיות |  |  |
| `note-editor.fieldNames.collection` | Area | תחום |  |  |
| `note-editor.fieldNames.coverImage` | Cover image | תמונת שער |  |  |
| `note-editor.fieldNames.featured` | Featured order | מיקום בין המומלצות |  |  |
| `note-editor.fieldNames.publishedAt` | Publish date | תאריך פרסום |  |  |
| `note-editor.fieldNames.seo` | Search and sharing | חיפוש ושיתוף |  |  |
| `note-editor.fieldNames.he` | Hebrew | עברית |  |  |
| `note-editor.fieldNames.links` | Links | קישורים |  |  |
| `note-editor.shortcuts` | Shortcuts: Ctrl+B bold, Ctrl+I italic, Ctrl+K link, Ctrl+E code, Ctrl+S save, Ctrl+Shift+P preview. | קיצורים: Ctrl+B מודגש, Ctrl+I נטוי, Ctrl+K קישור, Ctrl+E קוד, Ctrl+S שמירה, Ctrl+Shift+P תצוגה מקדימה. |  |  |
| `history.historyLabel` | Notes in this area, newest first | הרשימות בתחום, מהחדשה לישנה |  |  |
| `history.notesOn(…)` | Notes on 3 | רשימות מ־3 |  |  |
| `history.undated` | Undated notes | רשימות ללא תאריך |  |  |
| `history.noteId` | Note id | מזהה רשימה |  |  |
| `history.copyLink` | Copy link | העתקת קישור |  |  |
| `history.copyLinkTo(…)` | Copy a link to "3" | העתקת קישור אל "3" |  |  |
| `history.shareNote(…)` | Share "3" | שיתוף "3" |  |  |
| `history.share` | Share | שיתוף |  |  |
| `history.openNote(…)` | Open "3" | פתיחת "3" |  |  |
| `history.copied` | Link copied | הקישור הועתק |  |  |
| `history.copyFailed` | Couldn’t copy. The link is in the address bar once the note is open. | ההעתקה נכשלה. הקישור מופיע בשורת הכתובת כשהרשימה פתוחה. |  |  |
| `history.shareOn(…)` | Share on 3 | שיתוף ב־3 |  |  |
| `history.updated` | Updated | עודכנה |  |  |
| `history.updatedOn(…)` | Updated 3 | עודכנה ב־3 |  |  |
| `history.repo` | Repository | מאגר |  |  |
| `history.language` | Language | שפה |  |  |
| `history.stars` | Stars | כוכבים |  |  |
| `history.forks` | Forks | פיצולים |  |  |
| `history.release` | Latest release | גרסה אחרונה |  |  |
| `history.pushed` | Last push | עדכוני קוד אחרונים |  |  |
| `history.licence` | Licence | רישיון |  |  |
| `history.asOf(…)` | as of 3 | נכון ל־3 |  |  |
| `history.factsAsOf(…)` | Repository facts as of 3 | נתוני המאגר נכונים ל־3 |  |  |
| `history.factsNoTime` | Repository facts from the last scheduled read | נתוני המאגר מהקריאה המתוזמנת האחרונה |  |  |
| `history.aboutArea` | About this area | על התחום |  |  |
| `history.goToProject` | Go to the project | לפרויקט |  |  |
| `history.viewRepo` | View the repository | למאגר |  |  |
| `history.rss` | RSS for this area | RSS של התחום |  |  |
| `history.docs` | Published docs | תיעוד שפורסם |  |  |
| `history.topics` | Topics | נושאים |  |  |
| `history.topicShare(…)` | 3: X notes, Y | 3: X רשימות, Y |  |  |
| `history.other` | Other | אחר |  |  |
| `history.noTopics` | No topics yet. | עוד אין נושאים. |  |  |
| `history.filteredBy` | Topic | נושא |  |  |
| `history.clearFilter` | Show every note | כל הרשימות |  |  |
| `history.emptyArea` | No notes in this area yet. | עוד אין רשימות בתחום הזה. |  |  |
| `history.emptyAreaBody` | Subscribe to the feed and the first one will find you. | אפשר להירשם לפיד, והראשונה תגיע אליכם. |  |  |
| `history.keysHint` | move through the notes; Enter opens one. | עוברים בין הרשימות; Enter פותח. |  |  |
| `history.shown(…)` | 3 of X notes | 3 מתוך X רשימות |  |  |
| `log.title` | Channel log | יומן פעילות |  |  |
| `log.lede` | Everything that happens on the site, newest first: notes, releases, pushes, site releases and new areas. | כל מה שקורה באתר, מהחדשה לישנה: רשימות, גרסאות, עדכוני קוד, גרסאות אתר ותחומים חדשים. |  |  |
| `log.log` | Channel log | יומן פעילות |  |  |
| `log.railLabel` | Filter the log | סינון היומן |  |  |
| `log.kinds` | Kind | סוג |  |  |
| `log.areas` | Area | תחום |  |  |
| `log.kindPlural.post` | Notes | רשימות |  |  |
| `log.kindPlural.release` | Releases | גרסאות |  |  |
| `log.kindPlural.push` | Pushes | עדכוני קוד |  |  |
| `log.kindPlural.site` | Site | האתר |  |  |
| `log.kindPlural.area` | Areas | תחומים |  |  |
| `log.clear` | Clear the filters | ניקוי הסינון |  |  |
| `log.anyKind` | Any kind | כל סוג |  |  |
| `log.anyArea` | Any area | כל תחום |  |  |
| `log.subscribe` | Subscribe | הרשמה |  |  |
| `log.subscribeBody` | The log as RSS, with the filters you have on. | היומן כ־RSS, עם הסינון הנוכחי. |  |  |
| `log.subscribeAll` | Every note, as RSS | כל הרשימות כ־RSS |  |  |
| `log.rss` | RSS | RSS |  |  |
| `log.feedTitle` | Yehuda Briskman · Channel log | Yehuda Briskman · יומן פעילות |  |  |
| `log.events` | Events | אירועים |  |  |
| `log.loadMore` | Load more | טעינת עוד |  |  |
| `log.loading` | Loading… | טוען… |  |  |
| `log.shown(…)` | 3 events shown | מוצגים 3 אירועים |  |  |
| `log.end` | That’s the whole log. | זה כל היומן. |  |  |
| `log.emptyTitle` | Nothing has happened on the site yet. | עוד לא קרה כלום באתר. |  |  |
| `log.emptyBody` | Notes, releases and pushes appear here as they happen. | רשימות, גרסאות ועדכוני קוד יופיעו כאן כשיקרו. |  |  |
| `log.noMatch` | No event matches these filters. | אין אירוע שמתאים לסינון. |  |  |
| `log.failedTitle` | The log couldn’t be loaded. | לא ניתן לטעון את היומן. |  |  |
| `log.failedBody` | The log is served by a small machine I run myself, and it isn’t answering right now. Usually that means a restart. | היומן מוגש משרת קטן שאני מפעיל בעצמי, והשרת לא עונה כרגע. לרוב מדובר בהפעלה מחדש ולא בתקלה קבועה. |  |  |
| `log.moreFailed` | The next events couldn’t be loaded. | לא ניתן לטעון את האירועים הבאים. |  |  |
| `log.leaves` | on GitHub | ב־GitHub |  |  |
| `log.inArea` | Area | תחום |  |  |
| `log.noAreas` | No areas yet. | עוד אין תחומים. |  |  |
| `nav/` | Home | בית |  |  |
| `nav/story` | Journey | מסלול מקצועי |  | Approved in the owner's copy review. |
| `nav/projects` | Work | פרויקטים |  | Approved in the owner's copy review. |
| `nav/blog` | Blogs | בלוג |  | Approved in the owner's copy review. |
| `seo.siteDescription` | Full-stack engineer and team lead in Tel Aviv. I ship products end to end and build the checks that prove they still work. | מהנדס פול־סטאק וראש צוות טכני בתל אביב. אני בונה ומשיק מוצרים מקצה לקצה, ובונה את הבדיקות שמוכיחות שהם עדיין עובדים. |  |  |
| `seo.blogsBody` | Writing on frontend engineering, infrastructure, and shipping products end to end, plus notes from each of my projects. | כתיבה על הנדסת פרונטאנד, תשתיות, והשקת מוצרים מקצה לקצה, ורשימות מכל אחד מהפרויקטים שלי. |  | Aligned to frontend, in English too. |
| `seo.journeyDescription` | The work along the years, as a timeline: when I started shipping, the projects I built and ran, and the roles in between. | העבודה לאורך השנים, כציר זמן: מתי התחלתי להשיק, הפרויקטים שבניתי והפעלתי, והתפקידים שביניהם. |  |  |
| `seo.accessibilityDescription` | Accessibility statement: this site aims to meet WCAG 2.2 at level AA, which includes the Israeli standard IS 5568, and how to report a barrier. | הצהרת נגישות: האתר שואף לעמוד ב־WCAG 2.2 ברמה AA, הכוללת את התקן הישראלי ת״י 5568, ואיך לדווח על מחסום. |  |  |
| `seo.mcpDescription` | Connect Claude, or any MCP client, to this site: read the posts and project areas with no sign-in, or sign in with GitHub to manage them. | חיבור Claude, או כל לקוח MCP, לאתר: קריאת הרשימות ותחומי הפרויקטים בלי התחברות, או התחברות עם GitHub כדי לנהל אותם. |  |  |
| `seo.logDescription` | Everything that happens on the site, newest first: notes, releases, pushes, site releases and new areas. | כל מה שקורה באתר, מהחדשה לישנה: רשימות, גרסאות, עדכוני קוד, גרסאות אתר ותחומים חדשים. |  |  |
| `seo.siteTitle` | Yehuda Briskman · Full-stack engineer & team lead | Yehuda Briskman · מהנדס פול־סטאק וראש צוות טכני |  | Role rule: ראש צוות טכני. |
| `seo.siteSocial` | I ship products end to end, and build the checks that prove they work. Tel Aviv. | אני בונה ומשיק מוצרים מקצה לקצה, יחד עם הבדיקות שמוכיחות שהם עובדים. תל אביב. |  |  |
| `seo.role` | full-stack engineer and team lead | מהנדס פול־סטאק וראש צוות טכני |  |  |
| `seo.jobTitle` | Full-stack engineer and team lead | מהנדס פול־סטאק וראש צוות טכני |  |  |
| `seo.elsewhere` | Elsewhere | ברשת |  |  |
| `seo.homeProjects` | Projects: what I have built and run | פרויקטים: מערכות שבניתי ותפעלתי |  |  |
| `seo.homeNotes` | Notes: writing on frontend engineering and infrastructure | רשימות: כתיבה על הנדסת פרונטאנד ותשתיות |  | Aligned to frontend, in English too, to match the hero. |
| `seo.blogs` | Blogs | בלוג |  |  |
| `seo.blogsDescription` | Writing on frontend engineering, infrastructure, and shipping products end to end. | כתיבה על הנדסת פרונטאנד, תשתיות, והשקת מוצרים מקצה לקצה. |  | Aligned to frontend, in English too. |
| `seo.notesAlt` | Notes by Yehuda Briskman | רשימות מאת Yehuda Briskman |  |  |
| `seo.work` | Work | פרויקטים |  |  |
| `seo.workDescription` | Things I have built and run end to end, each with its own notes, documentation and source. | מערכות שבניתי ותפעלתי מקצה לקצה, ולכל אחד הרשימות, התיעוד והקוד שלו. |  |  |
| `seo.projectsAlt` | Projects by Yehuda Briskman | פרויקטים מאת Yehuda Briskman |  |  |
| `seo.journey` | Journey | מסלול מקצועי |  |  |
| `seo.journeyTitle` | The long way round | שלב אחר שלב |  |  |
| `seo.accessibility` | Accessibility | נגישות |  |  |
| `seo.statement` | Statement | הצהרה |  |  |
| `seo.home` | Home | בית |  |  |
| `seo.developers` | Developers | למפתחים |  |  |
| `seo.mcp` | MCP server | שרת MCP |  |  |
| `seo.mcpCode` | Claude Code | Claude Code |  |  |
| `seo.mcpConnector` | claude.ai and Claude Desktop: add a custom connector with the URL | claude.ai ו־Claude Desktop: הוספת מחבר מותאם אישית עם הכתובת |  |  |
| `seo.mcpPublic` | Anyone can connect and read, with no account and no sign-in: | כל אחד יכול להתחבר ולקרוא, בלי חשבון ובלי התחברות: |  |  |
| `seo.mcpOwner` | Owner access, with a GitHub sign-in: | גישת בעל האתר, עם התחברות באמצעות GitHub: |  |  |
| `seo.log` | Channel log | יומן פעילות |  |  |
| `seo.logBody` | Everything that happens on the site, newest first. | כל מה שקורה באתר, מהחדשה לישנה. |  |  |
| `seo.notes` | Notes | רשימות |  |  |
| `seo.allProjects` | All projects | כל הפרויקטים |  |  |
| `seo.notFound` | Not found | לא נמצא |  |  |
| `seo.notFoundDescription` | That page does not exist. | הדף הזה לא קיים. |  |  |
| `seo.writtenInEnglish` |  | הרשימה הזאת כתובה באנגלית. |  |  |
