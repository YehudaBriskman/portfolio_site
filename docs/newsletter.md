# Newsletter: audience and campaigns

The owner's own mailing list: visitors sign up, confirm by email, and the owner
sends them campaigns. Everything is stored in the site's CouchDB; the mail goes
out through the same SMTP account as the contact form. No third-party list
service is involved, and no mail carries open or click tracking.

Everything below was read from the code at the paths cited. Where a behaviour
is a limit or a gap it says so.

> **Not legal advice.** The sections on Israeli commercial mail list what the
> code does and what the owner has to decide. They are not a legal opinion; get
> one before the first real send.

## Where things live

| Part | Code |
|---|---|
| Public routes (`/api/subscribe`) | `backend/src/audience/public.route.ts` |
| Admin routes (`/api/admin/audience`) | `backend/src/audience/admin.route.ts` |
| Contact and group types, validation | `backend/src/audience/schemas.ts` |
| Store, recipients, pending cleanup | `backend/src/audience/store.ts` |
| Signed links | `backend/src/audience/tokens.ts` |
| Confirmation mail, unsubscribe URLs | `backend/src/audience/mail.ts` |
| Campaign routes (`/api/admin/campaigns`) | `backend/src/campaigns/route.ts` |
| Sender tick | `backend/src/campaigns/sender.ts` |
| Campaign mail (footer, headers) | `backend/src/campaigns/render.ts` |
| From / Reply-To resolution | `backend/src/campaigns/config.ts` |
| Sender settings and defaults | `backend/src/announce/schemas.ts` (`SenderSchema`, `DEFAULT_SENDER`) |
| Signup block and the three link pages | `web/src/components/SignupBlock.tsx`, `web/src/pages/{Follow,SubscribeConfirm,Unsubscribe,SubscribeManage}.tsx` |
| Admin screens | Marketing tabs in the Announce admin page; "Sender & delivery" in Settings, Advanced (`web/src/components/admin/announce/sender/`) |

Admin routes sit behind `requireAdmin` and the audit log
(`backend/src/app.ts`, `backend/src/services/audit.ts`). The audit log stores
the target id and a SHA-256 of the before and after documents, never the
documents, so it holds no address.

## Data model

All documents are in the one CouchDB database.

| Document | Id | Holds |
|---|---|---|
| Contact | `contact:<hash>` | `email`, `name?`, `lang` (`en`/`he`), `groups` (slugs), `status`, `source` (`site`/`manual`/`import`), `consentAt`, `consentNote`, `topics` (`blog`, `releases`), `createdAt`, `updatedAt`, `confirmedAt?`, `unsubscribedAt?` |
| Group | `audience:<slug>` | `name`, `kind` (`system` or `manual`), `createdAt`. The system group `subscribers` receives site signups and cannot be deleted |
| Campaign | `campaign:<id>` | `name`, `subject`, `preheader?`, `bodyText`, `blocks?`, `groups`, `lang` (`en`/`he`/`all`), `topic?`, `status`, `sendAt?`, `counters` (`queued`, `sent`, `failed`, `suppressed`), `eventId?`, `startedAt?`, `finishedAt?`. No addresses |
| Send result | `send:<campaignId>:<hash>` | one per recipient per campaign: `status` (`attempting`, `sent`, `failed`, `suppressed`, `deferred`), `at`, a scrubbed `error?`, `kind?` and `code?` (the classified failure and numeric SMTP reply), `tries?`, `retryAt?`. The contact is referenced by hash only |
| Sender state | `sender:state` | this hour's and today's send counts, across all campaigns |
| Signing secret | `secret:subscribe` | see "Signed links" |
| Settings | `settings:announce` | the `sender` block: see "Sender settings" |

`<hash>` is the first 32 hex characters of SHA-256 of the lowercased, trimmed
address (`hashEmail` in `store.ts`). It is how every route and every link names
a contact. It is not secret: anyone who knows an address can compute it. To
find a contact's hash from an address:

```sh
printf %s 'someone@example.com' | tr 'A-Z' 'a-z' | sha256sum | cut -c1-32
```

Contact statuses: `pending` (signed up, not confirmed), `active` (the only
status that is ever mailed), `unsubscribed`, `suppressed`.

## Flows

### Double opt-in

1. `POST /api/subscribe` with `{email, name?, lang, topics?}`. Always answers
   `202 {ok:true}` whether the address is new, known, suppressed or a bot, so
   the form cannot be used to find out who is on the list. A filled honeypot
   field `website` is answered the same way and nothing is stored.
2. A new address is stored as `pending`, `source: "site"`, group `subscribers`,
   `consentAt` now and `consentNote` `site-form-v1` (`SITE_FORM_VERSION`). The
   confirmation mail is sent in the background.
3. A pending address asking again is mailed again only if its record is more
   than two minutes old (`RESEND_AFTER_MS`). An `unsubscribed` address asking
   again goes back to `pending` and must confirm again. `active` and
   `suppressed` addresses: nothing happens, nothing shows.
4. The link in the mail opens `/subscribe/confirm?token=`, a page that only
   shows a "Confirm my subscription" button; opening it changes nothing, so a
   mail scanner cannot subscribe anyone. The click calls
   `POST /api/subscribe/confirm` with the token in the body. A valid,
   unexpired token on a `pending` contact sets `active` and `confirmedAt`.
   Tokens are kept out of logs: nginx logs these pages and `/api/subscribe`
   without the query string, the API's request and error logs drop the query
   of token and `/api/admin` routes, and these pages send `Referrer-Policy:
   no-referrer`.
5. A pending contact is treated as expired once `updatedAt` is older than
   `pendingTtlDays` (default 7, allowed 1 to 30). Expired contacts are deleted
   lazily: a sweep runs, at most once a minute per process, when someone signs
   up, opens the admin audience list or group counts. Until then an expired
   record can sit in the database, but its link already answers "invalid".
   Signing up again over an expired record starts a fresh pending record.

Rate limits (`backend/src/rate-limit.ts`): signup 10 requests per 15 minutes
per client address; confirm, unsubscribe and manage links 60 per 15 minutes.

### Unsubscribe and one-click

Every campaign mail carries a personal link in the footer (`/unsubscribe?token=`)
and the headers `List-Unsubscribe: <…/api/subscribe/unsubscribe?token=…>`,
`List-Unsubscribe-Post: List-Unsubscribe=One-Click` and `Precedence: bulk`
(`campaigns/render.ts`). A mail client's one-click is a form POST with
`List-Unsubscribe=One-Click` and the token in the query
(`public.route.ts`); the page does the same with a JSON body. Either sets
`status: "unsubscribed"` and `unsubscribedAt`. Already-unsubscribed and
suppressed contacts get the same success answer.

Unsubscribe and manage links are valid for 3 years (`mail.ts`); the
confirmation link for `pendingTtlDays`.

The manage page (`/subscribe/manage`) shows a masked address, and lets the
person change language and topics. A suppressed contact cannot use it.

The confirmation mail itself has no unsubscribe link: it is a one-off reply
to a sign-up, and says to ignore it if the sign-up was not the reader's.

### Suppression

Suppression is the owner's "never mail this address" list. Same document, status
`suppressed`:

- `POST /api/admin/audience/suppression {email}` suppresses a known contact, or
  creates a stub (`lang: "en"`, no groups, no topics) for an unknown address.
- A suppressed address is never re-added: signup does nothing, a manual add is
  refused (409), an import skips it, the admin cannot edit it, and its erasure is
  refused until it is lifted.
- `DELETE /api/admin/audience/suppression/:hash` lifts it to `unsubscribed`,
  not `active`. The person is mailed only after signing up and confirming again.
- The sender re-checks the fresh contact record and `isSuppressed` for every
  recipient immediately before sending, so a suppression made while a campaign
  runs is honoured by the next recipient.

### Bounces: what the sender does by itself

Only what the SMTP server says **while sending** is handled. Each failure is
classified from nodemailer's error (`providers/classifySmtpError.ts`; the
result doc keeps the `kind` and the numeric `code`, never the text or an address):

| Kind | Examples | What happens |
|---|---|---|
| `hard` | 550 5.1.1 unknown user, 5.1.x, 5.2.1 account disabled, 551, 553 | the contact becomes `suppressed` (`suppressedReason: hard-bounce`); never deleted |
| `soft` | 452 / 5.2.2 mailbox full, other 4xx | counted on the contact (`softBounces`); the **third in a row**, across campaigns, suppresses it (`soft-bounces`); a delivered mail resets the count |
| `transient` | 421, 450, 451, timeouts, connection errors | the result is `deferred` and tried again 15 minutes later, **3 tries in all**, then `failed`; the contact is untouched |
| `policy` | 5.7.x, 554, a spam block, a bare 550 that does not name the mailbox | `failed`; the contact is **never** suppressed (it is about us, not them) |
| `auth` | EAUTH, 535 | pauses the campaign at once |

A suppression made this way shows in the suppression list like any other and is
lifted the same way (which also forgets the bounce).

**Auto-pause.** The sender sets the campaign to `paused` (with a `pausedReason`
the admin shows in words) when, counted since it started or was last resumed:
a login is refused; **5 failures or deferrals in a row**; **10% or more failed
after at least 20 attempts**; or **5% or more hard bounces after at least 20
attempts**. A paused campaign sends nothing. The owner fixes the cause and
presses Resume (`POST /api/admin/campaigns/:id/resume`): it goes back to
`scheduled`, the counting window restarts, and people already handled are
skipped. Cancel works on a paused campaign too.

Not handled: **asynchronous bounces and complaints**. A relay that accepts the
mail and bounces it later sends a report to the envelope sender (`MAIL_FROM`)
mailbox, and nothing reads it. The owner suppresses those by hand (see the
runbook).

### Who a campaign reaches

`listRecipients` (`store.ts`) yields only `active` contacts that are in at least
one of the campaign's groups, match the campaign's language when it is not
`all`, and have the campaign's topic switched on when it has one. An empty group
list matches nobody. Scheduling a campaign is refused (422) when the audience
has no active recipient, or when the footer identity is empty.

Admin audience actions: groups (list with counts, create, rename, delete a manual
group; contacts stay but leave it), contacts (search, add one with a required
consent note, edit, hard delete), CSV import (up to 5000 rows, needs
`consentConfirmed: true` and a consent note, adds contacts as `active`, skips
addresses that already exist in any status) and CSV export.

## Sender settings

Stored in `settings:announce` under `sender` and edited in Settings, Advanced,
"Sender & delivery". The public `/api/settings` does not serve this document.

| Setting | Default | Notes |
|---|---|---|
| `fromName`, `fromAddress` | empty | empty falls back to the env `MAIL_FROM`; "Reset to env default" in the screen |
| `replyTo` | empty | empty falls back to env `MAIL_REPLY_TO` |
| `footerIdentity` | empty | name and contact line printed in every campaign mail; **campaigns cannot be scheduled while it is empty** |
| `testRecipients` | none | up to 5; test sends go only to these, with `[Test] ` in the subject |
| `throttlePerHour` | 60 | 1 to 3600 |
| `dailyCap` | 200 | 1 to 10000 |
| `quietHours` | none | `from`, `to`, `tz`; may wrap midnight |
| `autoDraftCampaign` | off | a post or release event makes a **draft** for `subscribers`; never sends by itself (`campaigns/autodraft.ts`) |
| `pendingTtlDays` | 7 | 1 to 30 |
| `commercialLabel` | on | the Hebrew advertisement label, Hebrew recipients only |
| `confirmSubject/Body`, `unsubscribeNote` (EN, HE) | see `DEFAULT_SENDER` | placeholders `{name}`, `{site}`, `{days}`, `{link}` |

**In the app vs the environment.** Everything above is in the app. These are
environment only and are never shown or returned by any route:

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`: the mail
  account. `EMAIL_PROVIDER=smtp` is the default; the `emailjs` provider cannot send
  these mails (it refuses anything without an EmailJS template), so the newsletter
  needs SMTP.
- `MAIL_FROM` (required) and `MAIL_REPLY_TO`: the fallback sender.
- `SITE_URL`: the origin every link in a mail is built from.
- `SUBSCRIBE_SECRET`: optional, at least 16 characters (`backend/src/env.ts`).

The screen shows a warning (never a block) when the From domain differs from the
domains of `MAIL_FROM` and `SMTP_USER` (`campaigns/config.ts`).

An owner edit that removes `{link}` from the confirmation body gets the link
appended anyway (`audience/mail.ts`). The same is **not** done for the
unsubscribe note in campaigns: if its `{link}` is deleted the footer has no link
(the `List-Unsubscribe` header is still sent). Keep `{link}` in both notes.

### Signed links

Confirm, unsubscribe and manage links carry `{t, h, exp}` signed with
HMAC-SHA256, compared in constant time; `h` is the contact hash, never an
address (`audience/tokens.ts`). Every failure (bad signature, wrong kind,
expired, unknown contact) gets the same "invalid or expired" answer.

The key is `SUBSCRIBE_SECRET` when set. Otherwise it is a random 32-byte secret
generated on first use and stored in the CouchDB document `secret:subscribe`; no
API returns it. Rotating it invalidates **every outstanding link**, including the
unsubscribe link in every mail already delivered (valid 3 years until then). See
the runbook before doing it.

## Sending

### Throttling, daily cap, quiet hours

All in `campaigns/sender.ts`.

- The tick runs every 30 seconds and does at most 25 recipients per campaign
  per tick (`BATCH_MAX`).
- Budget is shared by all campaigns: at most `throttlePerHour` sends per clock
  hour and `dailyCap` per day. The hour and the day roll over in the quiet-hours
  time zone, or UTC when none is set. The budget is reserved before sending and
  the unused part refunded, so a crash never overspends. Mail is sent one
  recipient at a time.
- Inside quiet hours the whole tick does nothing: nothing is claimed and nothing
  is sent. `from` is inclusive, `to` exclusive.
- With the defaults (60 an hour, 200 a day) a 200-person list takes about
  three and a half hours, and the day's cap is then used up.

### The tick, the lock and single replica

`startSender()` is called from `backend/src/server.ts` and starts a
`setInterval` that is `unref`ed, so it never keeps the process alive.

A `scheduled` campaign whose `sendAt` has passed is claimed by rewriting it as
`sending` with the revision that was read. If another tick rewrote it first,
CouchDB answers **409 and the claimer simply moves on**: that 409 is the lock and
it is not an error. Each recipient is claimed the same way: the `send:` doc is
created before the mail goes out, and a 409 on create means someone already has
that recipient. The shared rate document is also written by revision.

**Run one API replica.** The tick's in-process "already running" guard is per
process. The per-document 409s stop two replicas from mailing the same person in
the normal case, but two replicas would each scan the whole audience every
tick, race for the budget document and make the counters noisy. The deployment is
a single node (`docs/manual/deploy.md`); scaling the API to more than one replica
is untested for the sender.

### Resume after a crash or restart

State is in CouchDB, so a restart changes nothing: the campaign stays `sending`
and the next tick continues. People with a `sent`, `failed` or `suppressed`
result are skipped. A result stuck at `attempting` for more than 5 minutes
(`STALE_ATTEMPT_MS`) belongs to a crashed run and is **retried**. The known
trade-off: if the process died after the SMTP server accepted a message and
before the result was written, that one person gets the mail twice. A `failed`
recipient is not retried inside the same campaign. A `deferred` one (a transient
SMTP error) is retried 15 minutes later, up to 3 tries; until it is done the
campaign stays `sending`.

When nobody is left to do the campaign becomes `sent`, or `failed` when half or
more of the attempts failed. A campaign stopped by the auto-pause (below) is
`paused` and sends nothing until it is resumed.

### Cancel

`POST /api/admin/campaigns/:id/cancel` works on `scheduled`
and `sending` campaigns. The sender checks the campaign's status before every
recipient, so a cancel stops the run at the next person. Mail already handed to
SMTP cannot be recalled. A canceled campaign cannot be restarted: only a `draft`
or `scheduled` one can be queued. To mail the rest, duplicate the content into a
new campaign, which will reach **everyone again**, because results are keyed by
campaign. Un-scheduling a `scheduled` campaign (`schedule` with `sendAt: null`)
returns it to `draft`. Drafts and finished campaigns can be deleted; a
`scheduled` or `sending` one must be canceled first.

## Backups, restore and erasure

### Backups

Contacts live in the same CouchDB database as the site content. This repository
does not define backups: the cluster is defined in
[oci-free](https://github.com/YehudaBriskman/oci-free) and
`docs/i18n/bilingual-content-design.md` refers to nightly backups of "the one
database". Confirm there how often, where to, how long they are kept and who can
read them: they contain every address.

Two cautions that follow from the code:

- **A restore can undo unsubscribes and erasures** made after the backup was
  taken, because those are edits to documents that the older backup still has in
  their earlier state. After any restore, before the next send, re-apply from the
  owner's own record every erasure request received since the backup, and
  re-check recent unsubscribes (the audit log lives in the same database and is
  restored with it). Keep erasure requests somewhere outside the database.
- A manual copy is the CSV export (`GET /api/admin/audience/contacts/export.csv`:
  email, name, lang, groups, status, source, consentAt, consentNote, createdAt).
  **Do not feed an export back through Import.** Import reads only email, name
  and lang, ignores the status column and adds every missing address as `active`
  with a new consent time, which would re-activate unsubscribed and unconfirmed
  people. The export has no `topics`, `confirmedAt` or `unsubscribedAt` either.

### Erasure on request

An admin hard delete removes the contact document: `DELETE
/api/admin/audience/contacts/:hash` (the audience list's `q` search finds a
contact by address or name). A `suppressed` contact is
refused until it is lifted from the suppression list (otherwise erasing it would
let the address be added again); lift it, then delete.

What remains after an erasure:

- `send:<campaignId>:<hash>` result documents, which hold the hash, a status and a
  time and no address. A hash can be recomputed from a known address, so treat
  them as pseudonymous. Neither deleting the contact nor deleting a campaign
  removes them.
- audit entries naming `contact:<hash>`, which store hashes of the documents, not
  their content.
- backups, until they are rotated out.

### After an unsubscribe

An unsubscribed contact is **not** erased. The whole record stays (address, name,
language, groups, topics, consent time and note, `unsubscribedAt`) with
`status: "unsubscribed"`; it is excluded from every send. The person can sign up
again, which returns them to `pending`. If they want the record gone, erase it.
The public privacy text is aligned with this (see below).

## Deliverability checklist

Do these before the first real send.

1. **SPF, DKIM, DMARC** on the domain of the From address: the SMTP provider's
   instructions give the DNS records. A From domain different from the SMTP
   account's domain triggers the warning in Sender & delivery and is likely to land
   in spam. Publish DMARC at least in monitoring mode and read its reports.
2. The `List-Unsubscribe` and `List-Unsubscribe-Post` headers are sent on every
   campaign mail; confirm they survive your SMTP provider by sending a test and
   reading the raw headers in the receiving mailbox.
3. Fill in the footer identity, the test recipients and the sender name, and send
   a test to two or three real mailboxes (a Gmail one included).
4. **Start small.** Set `dailyCap` to about 10 and `throttlePerHour` to about 5, and
   send the first campaign to a manual group of two people you know (create the
   group, add them with a consent note). Check that mail arrives in the inbox,
   that the unsubscribe link works and that the contact becomes `unsubscribed`.
   Raise the cap in steps over a few weeks.
5. Keep the list clean: only confirmed or consented addresses, and suppress
   bounces and complaints promptly (synchronous hard bounces are suppressed for you;
   asynchronous ones and complaints are not).
6. `SITE_URL` must be the public origin: every link in a mail is built from it.

## Israeli commercial mail: what the owner must confirm

**This is not legal advice.** The code was built around the points below as a
reasonable reading of Section 30A of the Communications Law (the "spam law");
whether that reading is right for this site and this owner is for a lawyer to
say. The owner needs to confirm:

| Point | What the code does | Owner to confirm |
|---|---|---|
| **Consent record** | Every contact stores `consentAt`, `consentNote` and `source`. Site signups store the form version `site-form-v1`; manual adds and imports require a consent note, and import requires a ticked statement that the people agreed | that double opt-in plus these fields is a sufficient record; that imported people really consented; whether the form version needs a copy of the text shown at the time |
| **"פרסומת" label** | Hebrew recipients' subject starts with `פרסומת: ` and the footer opens with `פרסומת`, while `commercialLabel` is on (default). English recipients get no label | whether the law applies to this mail at all (it may be a plain notice, not an advertisement), whether the label is wanted, and whether English mail needs one |
| **Unsubscribe in every mail** | Every campaign carries the footer link and the one-click headers; one click, no login. The confirmation mail has none | that this meets the "simple and clear" opt-out; that the confirmation mail does not need one |
| **Sender identity** | `footerIdentity` is printed in every mail and sending is blocked while it is empty | the exact text: the name and a way to reach the sender, and whether a postal address is required |
| Frequency promise | the signup text promises "at most a few a month"; nothing enforces it | that the owner will keep the promise |

### Every user-facing legal string

For the owner to approve. The Hebrew and English versions are in the same file
unless stated.

| String | File |
|---|---|
| Privacy section on the accessibility statement, `privacy`, `privacyIntro`, `privacyItems` (marked DRAFT in the file) | `web/src/i18n/statement.ts` |
| Consent sentence under the signup button, `consentBefore`, `consentLink`; the lede that promises "at most a few a month"; the signup, confirm, unsubscribe and manage pages' wording | `web/src/i18n/subscribe.ts` |
| Confirmation mail subject and body, EN and HE (owner-editable in Settings; defaults in code) | `backend/src/announce/schemas.ts`, `DEFAULT_SENDER` |
| Footer unsubscribe note, EN and HE (owner-editable; defaults in code) | `backend/src/announce/schemas.ts`, `DEFAULT_SENDER` |
| The "פרסומת" label (`COMMERCIAL_LABEL_HE`) and where it is placed | `backend/src/campaigns/render.ts` |
| Footer identity (entered by the owner) | Settings, "Sender & delivery" |
| Form version recorded as consent, `site-form-v1` | `backend/src/audience/schemas.ts` (`SITE_FORM_VERSION`) |

## Runbook

### A campaign is stuck in `sending`

First check whether it is stuck or only slow: the counters in the Campaigns tab
move by up to 25 per tick (30 s) while budget lasts. Then, in order:

1. **Quiet hours.** Inside the window the tick does nothing at all. Wait, or edit
   the window.
2. **Budget used up.** The hourly limit resets at the next clock hour and the daily
   cap at the next day, in the quiet-hours time zone (UTC if none). Raise
   `throttlePerHour` or `dailyCap` in Sender & delivery to go on sooner.
3. **The API is down or restarting**, or CouchDB is. The campaign resumes by itself
   when both are back; nothing needs doing.
4. **The tick is failing.** Search the API logs for `sender tick failed` and
   `campaign tick failed`; the message names the cause (usually CouchDB). Failed
   recipients count under `failed`; if every recipient fails the campaign ends as
   `failed`, which usually means the SMTP credentials or the From domain.
5. If a campaign has to stop now, **Cancel** it. It stops at the next recipient.
6. If a restart left someone at `attempting`, they are retried after 5 minutes: do
   not cancel and resend, or that person gets it twice.

### "Someone says they never subscribed"

1. Find the contact: in the Audience tab search the address, or compute its hash
   (command above) and open the contact. Check `source`, `consentAt`,
   `consentNote` and `confirmedAt`.
2. `source: "site"` with a `confirmedAt` means someone opened the link in a mail
   sent to that address. `pending` with no `confirmedAt` means nobody has
   confirmed: they will not be mailed and the record is deleted when it expires.
3. `manual` or `import` means the owner added them, and the `consentNote` is what
   was recorded. If it does not hold up, do not argue: set the contact to
   unsubscribed (or erase it if they ask) and reply to them.
4. If they want to be forgotten, erase (see above); if they only want no mail,
   suppressing is safer, since an erased address can be signed up again by anyone.
5. Do not tell anyone else whether an address is on the list.

### A mail bounced or someone complained

A bounce the SMTP server reports while sending is handled by the sender (see
"Bounces"). Nothing reads asynchronous bounce reports (they go to the `MAIL_FROM`
mailbox) or complaints, so check that mailbox after every campaign.

1. In the Audience tab's suppression panel, add the address (`POST /api/admin/audience/suppression`).
   A suppressed address is never mailed again by a campaign, a signup or an import.
2. Use suppression, not delete, so the address cannot be re-added. A person who
   complained and asks to be erased is the one case for lifting the suppression and
   then deleting.
3. A spike of bounces or complaints: stop (cancel running campaigns), lower the cap,
   and check SPF, DKIM and DMARC and the list's origin before sending again.
4. A campaign shows **Paused**: read the reason on its page. A login refusal means
   the SMTP username or password (env) is wrong or revoked; five failures in a row
   means the relay or the From address; a failure or bounce rate means look at the
   failures before resuming. Resume only when the cause is fixed, or Cancel.

### Rotate the signing secret

Do this only when the secret may have leaked. Anyone holding it can forge an
unsubscribe or manage link for any contact whose hash they know (an address and
a hash are interchangeable to anyone who can compute SHA-256). The cost is that
**every link already sent stops working**: unconfirmed signups must sign up again,
and every delivered mail's unsubscribe link and one-click header answer "invalid".

1. Cancel any running campaign. Decide how you will handle the people who reply
   asking to be unsubscribed (by hand in the Audience tab: set the contact to
   unsubscribed, or suppress them).
2. If `SUBSCRIBE_SECRET` is set: put a new value (at least 16 random characters)
   in the environment and restart the API. If it is not set: delete the document
   `secret:subscribe` in CouchDB (there is no screen or route for this; use
   CouchDB's own admin interface) **and restart the API**, which caches the
   secret in memory. A new one is generated on the next signed link.
3. Send yourself a test campaign and open its unsubscribe link, then sign up with
   a throwaway address and confirm, to prove the new secret works.
4. Expect a few "link invalid" replies from people with old mail, and say in the
   next campaign how to unsubscribe.
