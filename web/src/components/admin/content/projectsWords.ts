import { defineWords } from "@/i18n/words";

/*
 * The words /admin/projects adds when its list is a table and a project opens in
 * a side panel: the columns, the row actions and what removing one says. The
 * form's own labels stay in `formWords.ts`. Shortest accurate wording; the
 * Hebrew is the shortest of three tried, for the owner's review.
 */
export const useProjectsWords = defineWords(
  "adminProjects",
  {
    add: "New project",
    colOrder: "Order",
    colProject: "Project",
    colYear: "Year",
    colState: "State",
    colHebrew: "Hebrew",
    edit: "Edit",
    up: "Move up",
    down: "Move down",
    remove: "Remove",
    moved: "Moved",
    removed: (name: string) => `Removed ${name}`,
    tint: "Tint",
    red: "Red",
    green: "Green",
    blue: "Blue",
    stateHint: "A key or a release tag",
    none: "No projects yet.",
    listLabel: "Projects",
  },
  {
    add: "פרויקט חדש",
    colOrder: "סדר",
    colProject: "פרויקט",
    colYear: "שנה",
    colState: "מצב",
    colHebrew: "עברית",
    edit: "עריכה",
    up: "הזזה למעלה",
    down: "הזזה למטה",
    remove: "הסרה",
    moved: "הוזז",
    removed: (name: string) => `${name} הוסר`,
    tint: "גוון",
    red: "אדום",
    green: "ירוק",
    blue: "כחול",
    stateHint: "מפתח או תג גרסה",
    none: "אין פרויקטים עדיין.",
    listLabel: "פרויקטים",
  },
);
