/* The env schema wants mail settings the re-key script never uses; these are throwaways that reach nothing. */
export const REKEY_ENV_DEFAULTS: Record<string, string> = {
  MAIL_FROM: "rekey@example.invalid",
  CONTACT_TO: "rekey@example.invalid",
  EMAIL_PROVIDER: "smtp",
  SMTP_HOST: "unused.invalid",
  SMTP_USER: "unused",
  SMTP_PASS: "unused",
};
