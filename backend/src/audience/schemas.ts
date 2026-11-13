import { z } from "zod";

export const LANGS = ["en", "he"] as const;
export type Lang = (typeof LANGS)[number];
export const STATUSES = ["pending", "active", "unsubscribed", "suppressed"] as const;
export type Status = (typeof STATUSES)[number];
export type Topics = { blog: boolean; releases: boolean };

/*
 * One consent event. `textId`/`textHash` name the exact wording the person saw
 * (consent-texts.ts); null for manual and import, where the evidence is `note`.
 */
export type Consent = {
  textId: string | null;
  textHash: string | null;
  lang: Lang;
  at: string;
  confirmedAt?: string;
  source: "site" | "manual" | "import";
  note?: string;
};

export type Contact = {
  _id: string;
  _rev?: string;
  type: "contact";
  email: string;
  name?: string;
  lang: Lang;
  groups: string[];
  status: Status;
  source: "site" | "manual" | "import";
  consentAt: string;
  consentNote: string;
  /* The current consent and every one before it, newest last; append-only.
     Absent on contacts from before the registry: read them through consentOf(). */
  consent?: Consent;
  consentHistory?: Consent[];
  topics: Topics;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
  unsubscribedAt?: string;
  /** Consecutive soft failures (mailbox full, temporary refusal) across campaigns; reset by a delivered mail. */
  softBounces?: number;
  /** Set when the sender, not the owner, suppressed the address. */
  suppressedReason?: "hard-bounce" | "soft-bounces" | "complaint";
};

export type Group = { _id: string; _rev?: string; type: "audience"; name: string; kind: "system" | "manual"; createdAt: string };

export const SITE_FORM_VERSION = "site-form-v1";
export const SYSTEM_GROUP = "subscribers";

/* Lowercased and trimmed once, here, so the hash and the stored address always agree. */
export const Email = z.string().trim().toLowerCase().max(254).email();
const Name = z
  .string()
  .trim()
  .max(80)
  // No control characters: a name ends up in a mail body and an admin table.
  .refine((s) => !/[\u0000-\u001f\u007f]/.test(s), "No control characters");
const Lang = z.enum(LANGS);
const TopicsSchema = z.object({ blog: z.boolean(), releases: z.boolean() }).strict();
export const Slug = z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/);
export const Hash = z.string().regex(/^[a-f0-9]{32}$/);
const Token = z.string().min(10).max(1000);

export const SubscribeBody = z
  .object({
    email: Email,
    name: Name.optional(),
    lang: Lang,
    topics: TopicsSchema.optional(),
    /* The form version the client believes it showed; the server checks it is a registered id. */
    formVersion: z.string().max(60).optional(),
    /* Honeypot: invisible to people, filled by form-stuffing bots. */
    website: z.string().max(500).optional(),
  })
  .strict();

export const TokenBody = z.object({ token: Token }).strict();
export const ManagePut = z
  .object({ token: Token, lang: Lang.optional(), topics: TopicsSchema.optional() })
  .strict();
export const TokenQuery = z.object({ token: Token });

export const GroupBody = z.object({ name: z.string().trim().min(1).max(60) }).strict();
export const ContactCreate = z
  .object({
    email: Email,
    name: Name.optional(),
    lang: Lang,
    groups: z.array(Slug).max(50).default([]),
    consentNote: z.string().trim().min(3).max(500),
  })
  .strict();
/* `status` can only move a contact OUT of the list: a person who unsubscribed
   or has not confirmed is never made active by an admin edit. */
export const ContactPatch = z
  .object({
    name: Name.nullable().optional(),
    lang: Lang.optional(),
    groups: z.array(Slug).max(50).optional(),
    topics: TopicsSchema.optional(),
    status: z.literal("unsubscribed").optional(),
  })
  .strict();
export const ImportBody = z
  .object({
    csv: z.string().min(1).max(900_000),
    consentNote: z.string().trim().min(3).max(500),
    /* A literal true: the owner states the consent exists; absence is a 400. */
    consentConfirmed: z.literal(true),
    group: Slug.optional(),
  })
  .strict();
export const SuppressBody = z.object({ email: Email }).strict();
export const SUPPRESS_BULK_MAX = 500;
export const SuppressBulkBody = z.object({ text: z.string().min(1).max(100_000) }).strict();
export const ContactsQuery = z.object({
  group: Slug.optional(),
  status: z.enum(STATUSES).optional(),
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().max(100).optional(),
});
