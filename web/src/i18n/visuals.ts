import { defineWords } from "./words";

/*
 * The words of the admin's small visuals (Journey, MiniBar, Gauge): the
 * announcements a screen reader gets in place of the drawing. The labels
 * themselves (a sender, an audience, "310 of 500 today") come from the caller.
 * Hebrew follows the glossary and the register of `admin.ts`: nouns and
 * participles rather than imperatives.
 */
export const useVisualWords = defineWords(
  "visuals",
  {
    from: "From",
    to: "To",
    journey: (from: string, to: string) => `From ${from} to ${to}`,
    stepDone: "done",
    stepCurrent: "current step",
    stepUpcoming: "upcoming",
    branchPaused: "paused",
    branchFailed: "failed",
    branchCanceled: "canceled",
    stateActive: "in progress",
    stateDone: "delivered",
    stateFailed: "failed",
    ofTotal: (value: string, total: string) => `${value} of ${total}`,
    levelOk: "within the limit",
    levelWarn: "nearing the limit",
    levelDanger: "at or over the limit",
  },
  {
    from: "מאת",
    to: "אל",
    journey: (from: string, to: string) => `מאת ${from} אל ${to}`,
    stepDone: "הושלם",
    stepCurrent: "השלב הנוכחי",
    stepUpcoming: "עתידי",
    branchPaused: "מושהה",
    branchFailed: "נכשל",
    branchCanceled: "בוטל",
    stateActive: "בתהליך",
    stateDone: "נמסר",
    stateFailed: "נכשל",
    ofTotal: (value: string, total: string) => `${value} מתוך ${total}`,
    levelOk: "בתוך המגבלה",
    levelWarn: "מתקרב למגבלה",
    levelDanger: "בגבול המגבלה או מעבר לה",
  },
);
