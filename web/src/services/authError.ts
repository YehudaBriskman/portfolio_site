/* The admin services throw this one token on a 401 or 403. It is a signal for code, never text for a person:
   `ErrorState` turns it into a sentence and a way back in. */
export const NOT_AUTHORISED = "not-authorised";

export const isNotAuthorised = (e: unknown): boolean => e instanceof Error && e.message === NOT_AUTHORISED;

/* oauth2-proxy starts a new sign-in at this path and returns to `rd`. */
export const signInHref = (here: string): string => `/oauth2/start?rd=${encodeURIComponent(here)}`;

/* A 404 from the admin API: the thing asked for is not there (a deep link to a deleted post). */
export class NotFoundError extends Error {
  constructor() {
    super("Not Found");
    this.name = "NotFoundError";
  }
}

export const isNotFound = (e: unknown): boolean => e instanceof NotFoundError || (e instanceof Error && /^not found$/i.test(e.message));
