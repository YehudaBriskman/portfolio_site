import { z } from "zod";

/*
 * The server's field rules (backend/src/announce/schemas.ts, audience/schemas.ts),
 * in one place with no other imports. The email check IS the server's: same zod,
 * same chain. The rest are the same regexes and limits. rules.cases.json is the
 * table both sides are tested against (rules.test.ts here, rules.parity.test.ts
 * in the backend), so a change on one side that the other misses fails a test.
 */

const EMAIL = z.string().trim().toLowerCase().max(254).email();
export const emailOk = (v: string) => EMAIL.safeParse(v).success;

/** Hashtag: letters, digits and "_" only, 1 to 40 characters, "#" optional. */
export const HASHTAG = /^#?[\p{L}\p{N}_]{1,40}$/u;
export const HASHTAGS_MAX = 10;
export const hashtagOk = (v: string) => HASHTAG.test(v);

export const FROM_NAME_MAX = 80;
// eslint-disable-next-line no-control-regex -- same refusal list as the server
const CONTROL = /[\u0000-\u001f\u007f]/;
/** The From display name is spliced into a header: no quotes, brackets, backslash or control characters. */
export const fromNameOk = (v: string) => {
  const t = v.trim();
  return t.length <= FROM_NAME_MAX && !CONTROL.test(t) && !/["<>\\]/.test(t);
};

/** Quiet hours are 24-hour HH:MM; a blank box is not a time. */
export const hhmmOk = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

/** A contact's name: up to 80 characters, no control characters. */
export const CONTACT_NAME_MAX = 80;
export const contactNameOk = (v: string) => {
  const t = v.trim();
  return t.length <= CONTACT_NAME_MAX && !CONTROL.test(t);
};
