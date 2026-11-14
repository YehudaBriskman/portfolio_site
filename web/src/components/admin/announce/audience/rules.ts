import { z } from "zod";

/*
 * The audience rules the server enforces (backend/src/audience/schemas.ts), kept here so a form
 * says no to what the server would refuse, with the same library and the same chain. rules.test.ts
 * reads the server file and fails if either side drifts.
 */
export const EmailRule = z.string().trim().toLowerCase().max(254).email();
export const CONSENT_NOTE_MIN = 3;
export const CONSENT_NOTE_MAX = 500;

export const emailOk = (v: string) => EmailRule.safeParse(v).success;
export const consentNoteOk = (v: string) => v.trim().length >= CONSENT_NOTE_MIN && v.trim().length <= CONSENT_NOTE_MAX;
