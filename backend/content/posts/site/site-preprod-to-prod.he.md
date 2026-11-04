---
{
  "title": "ממיזוג ל־production: preprod, תג, ו־credential לכל סביבה",
  "subtitle": "איך שינוי מגיע ל־yehudabriskman.com, ולמה ה־job של ה־deploy לסביבה אחת לא יכול לגעת בשנייה",
  "excerpt": "מיזוג ל־main עושה deploy ל־preprod, ותג גרסה מקדם את אותם digests של images ל־production. לכל סביבה יש עכשיו credential משלו ל־cluster, וה־deploy מסרב ל־credential שמגיע לסביבה השנייה.",
  "linkLabels": ["PR #326, credential ל־cluster בכל סביבה"]
}
---
האתר רץ בשתי סביבות על אותו cluster קטן: preprod בכתובת
`preprod.yehudabriskman.com` ו־production בכתובת `yehudabriskman.com`. אלה
namespaces נפרדים, ולכל אחד מסד נתונים משלו. הרשימה הזו מתארת את הדרך
ששינוי עובר ממיזוג ועד production, ואת השינוי ב־1.2 ששומר על שתי הסביבות
מופרדות.

## הדרך

1. **PR** מריץ lint, בדיקת טיפוסים, בדיקות ו־build. הנתיבים שהשתנו קובעים
   אילו jobs ירוצו, ובדיקה יציבה אחת מכריעה אם אפשר למזג.
2. **מיזוג ל־`main`** בונה מועמד אחד לכל image, באופן טבעי ל־arm64, סורק
   אותו, מעלה בדיוק את ה־bytes האלה ומתעד אותם ב־release manifest שנשמר
   לצד ה־images. ה־preprod עושה rollout ל־digests האלה.
3. **תג `v*`** על commit שכבר רץ ב־preprod מקדם את אותם digests ל־production.
   שום דבר לא נבנה מחדש בשביל release; התג הוא שם ל־images שכבר עברו כל
   בדיקה.

אחרי כל rollout נבדקות המוכנות והגרסה מתוך ה־cluster. אם משהו נכשל אחרי
השינוי הראשון, שני ה־deployments חוזרים למצבם הקודם.

## credential אחד לכל סביבה

עד 1.2, שתי הסביבות קיבלו deploy עם credential משותף אחד ל־cluster. המשמעות
הייתה שה־job של ה־deploy ל־preprod החזיק credential שיכול לשנות את
ה־production. עכשיו:

- **לכל סביבה יש credential משלו**, שנשמר כסוד של סביבת GitHub המתאימה,
  כך שרק ה־job של אותה סביבה מקבל אותו.
- **הבחירה מפורשת.** ה־job בוחר את ה־credential לפי ה־namespace בתוך
  ה־shell, ולא בביטוי שהיה נופל בשקט ל־credential של הסביבה השנייה אם אחד
  מהם ריק.
- **ה־job של preprod נכשל אם הוא רואה את ה־credential של production**, כי
  זה אומר שהסוד משותף ברמת המאגר.
- **הבדיקה המקדימה מסרבת ל־credential שמגיע ל־namespace השני.** לפני שמשהו
  משתנה, היא שואלת את ה־cluster אם ה־credential יכול לשנות את ה־deployment
  של הסביבה השנייה. credential משותף שנשאר מפעם, או credential של מנהל,
  נתפסים שם.

הצד של ה־cluster, role לכל namespace שיכול לשנות את שני ה־deployments לפי
שם ותו לא, נמצא במאגר התשתית.

## בדיקת מוכנות בלי port-forward

בדיקות המוכנות הגיעו פעם ל־pods דרך port-forward. ההרשאה הזו הגיעה לכל pod
ב־namespace, בכל port, כולל מסד הנתונים. עכשיו הבדיקות עוברות דרך ה־proxy
של ה־services ב־cluster, וה־role מתיר בדיוק שני services, לקריאה בלבד.
הבדיקות עצמן לא השתנו; רק הדרך פנימה, והיא צרה יותר.

## איך זה נבדק

לסקריפט ה־deploy יש סדרת בדיקות משלו עם לקוח cluster מזויף. היא מכסה
credential של namespace אחד שעובר, credential שמגיע ל־namespace השני
ונדחה בשני הכיוונים, והרשאת proxy חסרה שעוצרת את ה־deploy לפני שמשהו
משתנה.
