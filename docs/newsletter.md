# Newsletter: audience and campaigns

See also [deliverability.md](deliverability.md) for DMARC, Postmaster Tools and the monthly mail-health check.

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
| Scheduled list-hygiene sweep | `backend/src/audience/sweep.ts` |
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
| Campaign | `campaign:<id>` | `name`, `subject`, `preheader?`, `bodyText`, `blocks?`, `groups`, `lang` (`en`/`he`/`all`), `topic?`, `status`, `sendAt?`, `counters` (`queued`, `sent`, `failed`, `suppressed`, `capped?`), `capOverride?` (`{at}`, set when the owner sent past the monthly limit), `eventId?`, `startedAt?`, `finishedAt?`. No addresses |
| Send result | `send:<campaignId>:<hash>` | one per recipient per campaign: `status` (`attempting`, `sent`, `failed`, `suppressed`, `deferred`, `capped`), `at`, a scrubbed `error?`, `kind?` and `code?` (the classified failure and numeric SMTP reply), `tries?`, `retryAt?`. The contact is referenced by hash only |
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
   by a timer (`backend/src/audience/sweep.ts`, hourly and once a minute after
   boot, in-process lock, idempotent), so the privacy page's "deleted after about
   a week" holds even when nobody opens the admin; the same purge also runs
   lazily when someone signs up or opens the audience list. Until a pass runs an
   expired record can sit in the database, but its link already answers
   "invalid". The contact id is the hash of the address, so signing up again
   after the purge starts a fresh pending record. Pending contacts are mailed
   only the confirmation (no reminder exists). The sweep stores counts only
   (`sweep:audience`: last run, last and total purged) and the Audience tab shows
   them. `pendingTtlDays` is editable in Sender settings, range checked on PUT.

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
- `POST /api/admin/audience/suppression/bulk {text}` suppresses many at once (the
  Audience tab's "Suppress many at once" box): addresses separated by lines,
  commas or `Name <address>`, at most 500 (413 above that), each validated and
  deduplicated like the single route. It answers `{suppressed, already, failed,
  invalid[]}`; the unreadable lines come back (clipped) for the owner to fix. The
  audit record holds counts only, never an address.
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
| `footerIdentity` | empty | the sender **name** line printed in every campaign mail (an older single free text is kept here as it was); **campaigns cannot be scheduled while it, or `identityEmail`, is empty** |
| `identityEmail` | empty | required contact email, printed in the footer; the send gate and the "ready to send" list name it when missing |
| `identityPostal` | empty | optional postal or P.O. box line; never required |
| `identityPhone`, `identityWebsite`, `identityLinkedin` | empty | optional contact lines printed after the email, only when filled in; checked on PUT only (https address without login or port, LinkedIn on linkedin.com, phone digits and `+ ( ) . -`); the order and filtering live in `contactLines()` (`announce/schemas.ts`), shared by the footer and the Settings preview |
| `testRecipients` | none | up to 5; test sends go only to these, with `[Test] ` in the subject |
| `throttlePerHour` | 60 | 1 to 3600 |
| `dailyCap` | 200 | 1 to 10000 |
| `maxPerContact30d` | 4 | most mails one person gets in any rolling 30 days; `0` = off; whole number 0 to 31, checked on PUT only (reads stay lenient, like the subscriber texts); see "The monthly limit per person" |
| `dailyLimit`, `monthlyLimit` | 90, 2700 | the **provider's** mail limits (limits, never credentials); whole numbers, monthly not below daily; PUT only. See "The mail budget" |
| `safety`, `reserveShare` | 0.9, 0.2 | planning factor 0.5 to 1; share of the day kept for confirmations 0 to 0.5 (shown as percent in the screen); PUT only |
| `quietHours` | none | `from`, `to`, `tz`; may wrap midnight |
| `autoDraftCampaign` | off | a post or release event makes a **draft** for `subscribers`; never sends by itself (`campaigns/autodraft.ts`). **Patch releases (x.y.Z, Z above 0) are never drafted**; minor, major, non-semver tags and posts are |
| `pendingTtlDays` | 7 | 1 to 30 |
| `labelMode` | `hebrew` | `hebrew` (Hebrew recipients), `all` (English mail gets `פרסומת | Ad` in the subject and `פרסומת | Advertisement` as its first line, DRAFT wording) or `off`. An older `commercialLabel: false` reads as `off` |
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
- `RESEND_WEBHOOK_SECRET`: optional, the `whsec_...` value of the Resend webhook (see "Bounces and complaints"). Unset: the endpoint answers 404.

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

### The monthly limit per person

`maxPerContact30d` (default **4**, `0` = off) is the number behind the "only when
there is something new" promise. It is **on after deploy** for an installation
whose saved settings predate it (the schema default applies).

- **What counts:** `send:` results with `status: sent` and `at` in the last 30 days
  (rolling), from every campaign and every topic. Not counted: `failed`,
  `suppressed`, `deferred`, `capped`, test sends and the confirmation mail.
  Nothing is stored on the contact; the count is derived from the result docs,
  with one Mango index `send-type-status-at` (`type`, `status`, `at`) created at
  boot beside the blog index (`ensureSendIndex`, `server.ts`). One scan per check,
  not per recipient (`sentCounts`, `campaigns/store.ts`).
- **At schedule and send-now** (`campaigns/route.ts`, `queueable`): if some
  recipients already have the maximum, the call answers **409**
  `{code:"cap", capped, total, max}` and the campaign stays a draft. The owner
  then sends again with `skipCapped: true` (go ahead; the sender skips them) or
  `overrideCap: true` (send to everyone; recorded as `capOverride: {at}` on the
  campaign and so in the audit log). Scheduling again without the override clears
  it. The campaign page shows how many would be skipped in the "before you can send"
  area (the audience route returns `overCap` and `cap`), and asks at the confirm step.
- **In the sender** (`campaigns/sender.ts`): the count is read once per batch, before
  the budget is reserved (a failed read sends nothing), and checked per recipient
  right before the mail. A recipient at the maximum gets a `send:` result with
  status `capped`: no mail, final, **not a failure**, not in the auto-pause health
  window, and `counters.capped` shows it. A capped person is not mailed later; the
  fix for release trains is a digest, not a retry. The campaign's own earlier
  results are not counted against it. A campaign with `capOverride` skips the check.
- **Unsubscribed and suppressed contacts** are decided before the limit and are
  unaffected.
- The limit is a promise the signup text does not yet state as a number: the lede
  says "only when there is something new". Change it to a number only together with
  owner approval, and keep the text and `DEFAULT_MAX_PER_CONTACT_30D` in step.

### The mail budget

Resend's free plan (100 a day, 3,000 a month, shared by everything the site sends;
the owner confirms the figures on the pricing page at signup) is why the sender
must know the quota instead of only a daily cap. The pure rules are in
`campaigns/budget.ts`; the counts come from `campaigns/budgetStore.ts`.

- **Usable** = limit x `safety` (defaults 90 and 2,700, so 81 a day and 2,430 a
  month). **Used** is counted over a **rolling 24 hours** and the **calendar month
  (UTC)**, never from the provider's reset time.
- **Reserve** = the larger of 10 and `reserveShare` of the usable day (17 by
  default). Newsletters never touch it: it is for confirmations, the contact notice
  and the auto-reply. Transactional mail spends it first; only a transactional count
  above it narrows the newsletter's room. The month holds back the same amount, so a
  nearly spent month still leaves room for confirmations.
- **Capacity** = usable - used - reserve, the smaller of the day's and the month's, never
  below 0. A tick sends `min(capacity, 25 per batch, throttle left, dailyCap left)`.
  At 0 the campaign **waits** (state stays `sending`, no mail, no failure) until the
  window rolls; there is no overage. Failed, deferred, capped and suppressed results
  are not counted, only mail that went out, exactly as the per-person limit counts.
- **Newsletter sends** are counted from the `send:` docs (`status: sent`, `at`), via the
  same index as the per-person limit. Nothing is kept in memory or beside them, so a
  restart cannot double count. A failed read throws and sends nothing.
- **Transactional sends** leave no send doc. They go through one place,
  `services/email.service.ts` (`sendCounted`), which adds one to a per-day counter doc
  `mailcount:<yyyy-mm-dd>` (`{count}` only, never an address) when the provider
  accepted the mail. Counting is best effort and never throws; a lost count only makes
  the budget a little more generous. Test sends are not counted.
- **`canSendTransactional()`** (`budgetStore.ts`) answers from the reserved share: yes
  inside it, beyond it only while the provider's own (not safety-reduced) limits have
  room. It fails open if the counts cannot be read. It is exposed only: the contact
  form and the confirmation mail do not call it yet, and their behaviour is unchanged.
- **The admin** reads `GET /api/admin/campaigns/budget[?remaining=N]` (counts only):
  the meter in Settings > Sender & delivery > Mail budget (last 24 hours and this
  month, what campaigns may still send, when they carry on), and "Needs N days,
  finishing about <date>" in the campaign's confirm step and progress panel. The
  estimate sends what fits now, then a full day's share per day (within the hourly
  pace and `dailyCap`), jumping to the 1st of the next month when this one runs out.
- **Alerts:** `onBudgetThreshold(hook)` (`budgetStore.ts`) fires once per month at 70%
  and 90% of the usable month (used = newsletters + transactional). The owner notifier
  is not built yet; it subscribes there and keeps its own record if it must survive a
  restart (the hook's own memory is per process).
- Not covered: a provider that counts differently (bounces, retries) or other apps
  sharing the account. Lower `safety` for that.

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
and the next tick continues. People with a `sent`, `failed`, `suppressed` or `capped`
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

- **A restore alone would undo unsubscribes and erasures** made after the backup
  was taken, because those are edits to documents that the older backup still has
  in their earlier state. The suppression ledger (next section) exists so that it
  does not: the ledger is a separate database that a content restore never touches.
  Still keep erasure requests somewhere outside the databases as a second record.
- A manual copy is the CSV export (`GET /api/admin/audience/contacts/export.csv`:
  email, name, lang, groups, status, source, consentAt, consentNote, createdAt).
  **Do not feed an export back through Import.** Import reads only email, name
  and lang, ignores the status column and adds every missing address as `active`
  with a new consent time, which would re-activate unsubscribed and unconfirmed
  people. The export has no `topics`, `confirmedAt` or `unsubscribedAt` either.

### The suppression ledger

A second CouchDB database, `portfolio_suppression` (env `LEDGER_DB`), on the same
server. One document per person who must not be mailed, keyed by the contact hash,
holding only `kind` (`unsubscribed`, `suppressed` or `erased`), the time, and for
`erased` an expiry 30 days out (the 14 nightly dumps plus a fortnight). No address,
no name, no reason text. It is still pseudonymous personal data (the hash can be
recomputed from a known address), kept for one purpose: honouring a refusal.

- **Written first.** Unsubscribe, one-click, admin unsubscribe, suppress, lift,
  hard bounce and erase write the ledger line before the contact document, so a
  crash between them leaves the person blocked, not mailed. A public unsubscribe
  still succeeds if the ledger is down; the guard backfills the line later.
- **Cleared by a fresh, confirmed signup.** Confirming removes an `unsubscribed` or
  `erased` line (before the contact turns active). A `suppressed` line is never
  cleared by signup; only the owner's "remove from suppression list" changes it
  (to `unsubscribed`). Import skips every address on the ledger; adding an
  `unsubscribed` or `suppressed` address by hand is refused.
- **The sender guard** (`campaigns/guard.ts`) runs at the start of every sender tick
  that has campaigns to work on. It reads the ledger, then fetches the matching
  contacts in one keyed query. An *active* contact the ledger says is unsubscribed
  or suppressed is set back; an active contact the ledger says is erased is deleted
  with its `send:` documents. It adds a count-only audit entry (`ledger.repair`) and
  a report that shows as a banner on the Audience and Campaigns tabs until the owner
  presses "I have checked". It also adds ledger lines for contacts already
  unsubscribed or suppressed that it does not know yet (this is how existing data
  enters the ledger after the upgrade) and deletes expired `erased` lines.
- **Fails closed.** If the ledger database cannot be read, or its `meta:ledger`
  marker is missing, no campaign is claimed or continued and the banner says so.
  The API creates the database and marker at boot if it may; if the CouchDB user
  cannot create databases, create `portfolio_suppression` once by hand, give the API
  user read and write on it, and restart. Never restore the ledger from an old
  backup over a newer one.
- **After a real restore:** restore the content database, start the API, let the
  next tick (or `POST /api/admin/audience/ledger/check`) run the guard, read the
  banner, check the audience, press "I have checked". Mail that went to people
  before the restore is not detected: a restore also rewinds `send:` documents, so
  a campaign sent shortly before the backup can be sent again to the same people.
  Check campaigns in `sending` or `scheduled` by hand after a restore.
- Losing the ledger's own disk loses it. Its nightly dump is tiny; keep it in the
  offsite copy once there is one.

### Erasure on request

An admin hard delete removes the contact document: `DELETE
/api/admin/audience/contacts/:hash` (the audience list's `q` search finds a
contact by address or name). A `suppressed` contact is
refused until it is lifted from the suppression list (otherwise erasing it would
let the address be added again); lift it, then delete. Erasing writes an `erased`
ledger line (30 days) first, then deletes the contact and that person's `send:`
documents. If the ledger cannot be written the erase fails and nothing is deleted.

What remains after an erasure:

- the ledger line (hash, kind, expiry; no address) until it expires.
- `send:` documents of campaigns sent before an erasure are deleted with the
  contact; deleting a campaign alone does not remove them.
- audit entries naming `contact:<hash>`, which store hashes of the documents, not
  their content.
- backups, until they are rotated out.

### After an unsubscribe

An unsubscribed contact is **not** erased. The whole record stays (address, name,
language, groups, topics, consent time and note, `unsubscribedAt`) with
`status: "unsubscribed"`; it is excluded from every send. The person can sign up
again, which returns them to `pending`. If they want the record gone, erase it.
The public privacy text is aligned with this (see below).

## Bounces and complaints (Resend webhook)

Bounces return to Resend, not to the app, so Resend tells the app by webhook:
`POST /api/webhooks/resend` (`audience/webhook.route.ts`). Mapping lives in
`audience/providerEvents.ts`; the Svix-style signature check in `audience/svix.ts`.

| Event | What happens |
|---|---|
| `email.complained` | suppressed, reason `complaint`; the complaint hook fires (`audience/complaintHook.ts`) |
| `email.bounced`, type Permanent | suppressed, reason `hard-bounce` |
| `email.bounced` (other) and `email.delivery_delayed` | one soft failure; the third suppresses (reason `soft-bounces`) |
| delivered, opened, clicked, anything else | answered 200, ignored, never stored |

Suppression goes ledger first, contact second (see "Backups, restore and
erasure"). Only active or pending contacts are touched. A request is accepted
only with a valid signature made with the secret, within 5 minutes of its
timestamp; anything else gets the same bare 400. Each event id is applied once.
Logs carry contact hashes only. No secret set means no endpoint (404).

**Owner steps**

1. Open <https://resend.com/webhooks> and choose **Add Webhook**.
2. Endpoint URL: the public API origin plus `/api/webhooks/resend`.
3. Events: `email.bounced`, `email.complained`, `email.delivery_delayed`.
4. Open the webhook's page and copy the **Signing Secret** (starts `whsec_`).
5. Put it in the backend environment as `RESEND_WEBHOOK_SECRET` and restart the API.
6. Use the webhook page's test send in Resend and expect a 200.

Resend's reference: <https://resend.com/docs/webhooks/introduction>. The free plan
allows one endpoint. Rotating the secret in Resend means updating the variable at
the same moment; until then events are rejected with 400 and Resend retries them.

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
| **"פרסומת" label** | the subject starts with `פרסומת: ` and the first visible line of the body (HTML and text) is `פרסומת`, for Hebrew recipients (`labelMode` `hebrew`, the default); `all` also labels English mail with DRAFT wording; `off` labels nothing | whether the law applies to this mail at all (it may be a plain notice, not an advertisement), whether the label is wanted, and whether English mail needs one |
| **Unsubscribe in every mail** | Every campaign carries the footer link and the one-click headers; one click, no login. The confirmation mail has none | that this meets the "simple and clear" opt-out; that the confirmation mail does not need one |
| **Sender identity** | the name, an optional postal line and a contact email are printed in every mail; sending is blocked while the name or the email is missing | whether email-only identity is enough, or a postal address or P.O. box is required |
| Frequency promise | the signup text says "only when there is something new" (no number); `maxPerContact30d` (default 4 per rolling 30 days) is enforced at schedule time and in the sender, with an explicit owner override; patch releases are not auto-drafted | that the wording is acceptable, and whether to put the number in the signup text now that it is enforced |

### Every user-facing legal string

For the owner to approve. The Hebrew and English versions are in the same file
unless stated.

| String | File |
|---|---|
| Privacy section on the accessibility statement, `privacy`, `privacyIntro`, `privacyItems` (marked DRAFT in the file) | `web/src/i18n/statement.ts` |
| Consent sentence under the signup button, `consentBefore`, `consentLink`; the lede ("only when there is something new"); the signup, confirm, unsubscribe and manage pages' wording | `web/src/i18n/subscribe.ts` |
| Confirmation mail subject and body, EN and HE (owner-editable in Settings; defaults in code) | `backend/src/announce/schemas.ts`, `DEFAULT_SENDER` |
| Footer unsubscribe note, EN and HE (owner-editable; defaults in code) | `backend/src/announce/schemas.ts`, `DEFAULT_SENDER` |
| The "פרסומת" label (`COMMERCIAL_LABEL_HE`) and where it is placed | `backend/src/campaigns/render.ts` |
| Footer identity (entered by the owner) | Settings, "Sender & delivery" |
| Form version recorded as consent, `site-form-v1` | `backend/src/audience/schemas.ts` (`SITE_FORM_VERSION`) |

## Contact form: what it may cost

The contact form shares the provider's daily quota (100 mails) with signup
confirmations and campaigns, so `backend/src/services/contactGuard.ts` limits it.
Every limit is silent: the visitor gets the same `200 {ok:true}` whether the
message was sent, dropped by a limit or caught by the honeypot.

| Limit | Value | When it trips |
|---|---|---|
| Honeypot (`website`) | must be empty | nothing is sent or counted |
| Per client | 5 messages / 15 min | message dropped |
| Whole form | 30 messages / hour | message dropped |
| Per address | 1 auto-reply / hour | owner notice still sent, auto-reply skipped |
| Daily mail ceiling | `CONTACT_DAILY_MAIL_CEILING`, default 30 mails / UTC day | both mails count; over it, auto-replies stop but owner notices are still sent |
| Daily notice ceiling | `CONTACT_DAILY_NOTICE_CEILING`, default 40 notices / UTC day | over it, the message is dropped and a warning is logged (no address) |

Counters live in memory (a restart resets them). The per-address window stores a
SHA-256 of the address, never the address. A dropped message is logged as a
warning without any address. The 40-requests / 15-minute junk limiter on
`/api/email` still answers 429.

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

1. In the Audience tab's suppression panel, add the address (`POST /api/admin/audience/suppression`),
   or paste several from a bounce report into "Suppress many at once".
   A suppressed address is never mailed again by a campaign, a signup or an import.
2. Use suppression, not delete, so the address cannot be re-added. A person who
   complained and asks to be erased is the one case for lifting the suppression and
   then deleting.
3. A spike of bounces or complaints: stop (cancel running campaigns), lower the cap,
   and check SPF, DKIM and DMARC and the list's origin before sending again.
4. Weekly, while the list is small: read the `MAIL_FROM` (bounce) mailbox for
   asynchronous bounces and complaints, suppress what it names, and look at
   Postmaster Tools (Gmail) if the domain has data there.
5. A campaign shows **Paused**: read the reason on its page. A login refusal means
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

## Mail design system

`backend/src/mail/render.ts` holds `renderMail(blocks, { lang, theme })`: heading, paragraph, button, list, card, image, divider and footer blocks in, one page and its plain-text twin out. Table layout at 600 px, inline styles, system fonts, 16 px body, AA colours from the site palette, 44 px buttons, no script, form, remote CSS or font, no tracking pixel and no redirecting links. `lang` and `dir` are on `<html>`; `theme: "auto"` (what is sent) adds the `prefers-color-scheme: dark` block. Images only from the site origin with alt, width and height. `mail/escape.ts` holds the one `esc`; nothing else in the mail path escapes. `renderMail` reports `bytes` and `oversize` (Gmail clips near 100 KB).

The campaign renderer (`campaigns/render.ts`) and the owner announce email (`announce/emailHtml.ts`) are built on it; their wording and the label, unsubscribe and identity behaviour are unchanged. The footer prints `contactLines()` (name, postal, email, phone, website, LinkedIn). Transactional mails (confirm, welcome, contact auto-reply) are not on it yet.

Look at every template: `cd backend && CHROMIUM_PATH=<chrome-headless-shell> npx tsx scripts/mail-gallery.ts <outDir> --shots` writes HTML and 390/600 px, light/dark screenshots (EN and HE, normal and markup/long-name stress copies).
