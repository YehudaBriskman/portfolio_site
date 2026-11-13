# Deliverability: DMARC, Gmail Postmaster Tools, monthly check

Owner runbook for keeping the site's mail out of spam and the domain hard to
spoof. It complements [newsletter.md](newsletter.md), which covers how the
mail is sent. Nothing here needs a code change: the owner edits DNS in
Cloudflare and one Gmail setting.

> **No secrets in this file.** Never paste an API key, SMTP password, report
> address or DNS hash into the repo. Where a value is private, this page says
> where to read it.

## 1. What is configured today, and how we know

Read from the real message headers of a mail delivered on 2026-11-13.

| Check | Result |
|---|---|
| SPF | pass for the domain |
| DKIM | pass for the domain, selector `resend` |
| DMARC | pass (aligned) |
| Sending provider | Resend, on Amazon SES in Ireland |
| Return path (bounce domain) | the `rsend` subdomain of the site domain |
| DMARC policy | `p=none` (monitor only, nothing is rejected or quarantined) |
| DMARC reports | go to the address Cloudflare shows under DNS > DMARC Management |
| Receiving mail | Cloudflare Email Routing |
| DNSSEC | on |

How to re-check yourself: in Gmail open a received message, "Show original",
and read the SPF, DKIM and DMARC lines at the top. All three must say PASS
and the domain shown must be the site domain, not the provider's.

`p=none` means a spoofer is not stopped today. Tightening it (section 2)
protects the domain and is a positive signal to mailbox providers, but only
once every real sender is proven clean.

## 2. Tightening DMARC step by step

Do these in order. Do not skip ahead.

1. **Wait at least four weeks** of reports with only known senders. Do
   section 3 first (it is a precondition).
2. **Read the reports.** Cloudflare dashboard: https://dash.cloudflare.com ,
   pick the domain, DNS > DMARC Management. It lists each source that sent
   as your domain and whether it passed SPF, DKIM and DMARC.
   - A healthy source: Resend/Amazon SES, 100% pass.
   - A failing source you recognise (for example Gmail sending your hand
     replies, or an old contact form tool): fix it (section 3) before going on.
   - A failing source you do not recognise: that is spoofing or a forgotten
     service. It is exactly what `quarantine` will stop. Note it.
3. **Quarantine at 25%.** Edit the existing `_dmarc` TXT record in Cloudflare
   DNS (do not add a second DMARC record; two records break DMARC). Value:

   ```
   v=DMARC1; p=quarantine; pct=25; rua=mailto:<REPORT-ADDRESS>
   ```

   `<REPORT-ADDRESS>` is the address Cloudflare shows under DNS > DMARC
   Management; keep whatever is in the current record. Wait two weeks and
   keep reading reports and watching for lost mail.
4. **Quarantine at 100%.** Same record with `pct=100` (or remove `pct`).
   Wait two more weeks.
5. **Optional: reject.** Only if reports stay clean. `p=reject`. Many sites
   stay on `quarantine` indefinitely; that is fine.

**Rollback:** set the record back to `v=DMARC1; p=none; rua=mailto:<REPORT-ADDRESS>`.
DNS changes on Cloudflare apply within minutes, though receivers may cache
for the record's TTL. Roll back at once if real mail goes missing.

## 3. Precondition: hand-written replies from Gmail

When you reply by hand from Gmail "as" the site address, the mail leaves
through Gmail's servers. Gmail is not in the site's SPF and does not sign
with the site's DKIM key, so those replies fail DMARC alignment. Under
`p=none` that is harmless. Under `quarantine` they would land in spam.

Fix: make that Gmail "Send mail as" entry send through the provider's SMTP so
the domain signs the mail itself.

1. In Resend, create a **separate API key used only for this**, with
   sending-only permission. Do not reuse the website's key, so it can be
   revoked alone. Keep it in a password manager, not in the repo.
2. In Gmail: Settings (gear) > See all settings > Accounts and Import >
   Send mail as > edit info on the site address (or Add another email
   address if it is not there).
3. Choose "Send through SMTP server" and enter:
   - SMTP server: `smtp.resend.com`
   - Port: `465`, Secured connection using SSL
   - Username: `resend`
   - Password: the new sending-only API key
4. Save, then confirm via the verification mail if Gmail asks.
5. Send a test to another mailbox, "Show original", and check DMARC says PASS
   with the site domain.

Trade-off: these replies now count toward the provider's sending limit (the
site's plan allows 100 a day), and appear in the provider's logs. A reply
mail is tiny against that, but a burst of manual replies plus a campaign on
the same day can hit it. Gmail also keeps the sent copy in your Sent folder
as before.

## 4. Gmail Postmaster Tools

URL: https://postmaster.google.com (sign in with a Google account).

**Verify the domain**
1. Add the domain. Google shows a TXT record to copy.
2. Cloudflare > DNS > Records > Add record: type TXT, name `@`, content the
   exact string Google gave. Proxy status does not apply to TXT.
3. Back in Postmaster Tools click Verify. It is usually immediate and can
   take up to about 10 minutes.

**Reading it.** Data only appears once enough mail reaches Gmail users each
day; a small list may show nothing, which is normal.
- **Spam rate:** the share of mail users marked as spam. Keep it below
  **0.1%** and never let it reach **0.3%** (Google's bulk-sender guidance).
  At 0.3% or more inbox delivery suffers.
- **Domain reputation:** a graded level for the domain (from Bad up to
  High). Falling reputation after a campaign means the list or content is
  the problem: stop and check who is marking it as spam.
- Also shown: authentication success (SPF, DKIM, DMARC) and encryption
  rates. They should be near 100%.

## 5. Monthly checklist (10 minutes)

- [ ] Cloudflare > DNS > DMARC Management: every source known, 100% pass.
- [ ] Postmaster Tools: spam rate under 0.1%, reputation not dropping.
- [ ] Send yourself a test; "Show original" shows SPF, DKIM, DMARC PASS.
- [ ] Resend dashboard: bounce and complaint counts low; no key you do not
      recognise.
- [ ] Newsletter suppression list looks sane (hard bounces and
      unsubscribes are honoured).
- [ ] Cloudflare DNS: no unknown records; DNSSEC still on; 2FA on the
      Cloudflare and provider accounts.
- [ ] Email Routing has routes for `postmaster@` and `abuse@` (mailbox
      providers and abuse desks write to them).

## 6. Adding a second sending provider later (Brevo as the example)

Do this when you need more volume or a fallback. Every sender of mail "from"
the domain must still pass SPF or DKIM **aligned** with the domain, or DMARC
will fail (and, after section 2, be quarantined).

1. Create the Brevo account and add the sending domain in its
   Senders/Domains settings. Brevo then shows the records to add.
2. In Cloudflare > DNS add exactly the records Brevo displays (typically a
   verification TXT and DKIM records, plus SPF/DMARC guidance). Set any
   CNAME to **DNS only** (grey cloud), never proxied, or verification fails.
3. SPF: there must be **one** SPF record. If Brevo asks for an `include:`,
   merge it into the existing record rather than adding a second one. Stay
   under SPF's 10 DNS lookups.
4. Leave the DMARC record as is. Do not add another.
5. SMTP for the site or Gmail: host `smtp-relay.brevo.com`, use the SMTP key
   from Brevo's SMTP & API page (not an API key), ports per Brevo's docs.
6. Verify: send a test, "Show original": SPF or DKIM PASS aligned with the
   site domain, DMARC PASS. Watch DMARC Management for a week.

## 7. Provider free-tier figures go stale

Any limit quoted for a provider (such as 100 mails a day) is a snapshot.
Re-check it on the provider's own pricing page before relying on it.

## What could not be verified when this was written

- The 2026-11-13 header results come from the owner's inspection; they were
  not re-run here.
- Brevo's exact DNS records and the SMTP host `smtp-relay.brevo.com` were not
  confirmed from its public docs (its SMTP page names ports 587, 2525 and
  465 but not the host); copy what the Brevo dashboard shows.
- The Resend "sending-only" key permission wording was not found on the SMTP
  docs page; check the key's permission choices in the Resend dashboard.
- Gmail Postmaster Tools could not be fetched without sign-in; the
  verification flow is from Google's help page, and the reputation level
  names are from general knowledge.
- Confirmed against vendor docs: Resend SMTP host, ports, username `resend`,
  password = API key; Gmail "Send mail as" path and port 465 SSL; Postmaster
  TXT verification; Google's 0.1% and 0.3% spam-rate guidance; Cloudflare
  DMARC Management shows sources and pass or fail.
