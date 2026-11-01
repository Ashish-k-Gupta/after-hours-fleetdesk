# FMCSA daily outreach automation

Google Apps Script source exported from the existing After Hours Daily FMCSA Shortlist project on 1 November 2026. The manifest preserves its V8 runtime, Asia/Kolkata time zone, Gmail advanced service, and declared scopes.

## Current behavior

Daily discovery targets active US interstate authorized-for-hire fleets with 5-15 power units carrying general freight or refrigerated food. The 30-day USDOT registration-age limit has been removed. The additional recent-authority-grant search still uses 7 days. Main eligibility also requires active property-carrier authority, reported required insurance, an inspection in the past 90 days, an acceptable service fit, an email with an MX record, and no previous direct mailbox contact.

Census discovery scans 250 records per page, with the cursor stored in Script Properties. Initial outreach is capped at 99 per day, sent in batches with a mailbox summary. Replies and follow-ups remain manual. Public FMCSA rate limits or stale data can prevent a successful run even when Gmail sending works.

## Working on the existing project

Use the existing Apps Script project signed in as `afterhours.fleetdesk@gmail.com`. `Code.gs` and `appsscript.json` are source files, not a standalone Node application. GitHub commits do not sync to Apps Script automatically.

Preserve the existing project's Script Properties and mailbox history when updating code. They hold the outreach ledger, current plan, pause state, and scan cursor. Those runtime records and triggers are not included in this repository. Do not start a second scheduler in a fresh project without migrating and reconciling that state; otherwise already-contacted prospects could be considered again.

- `previewDailyOutreach`: discovers and previews without prospect sending or advancing the scan cursor.
- `runDailyCheck` / `runOutreachBatch`: live daily discovery and sending handlers.
- `installDailyCheck`: runs the daily handler and then creates its time-based trigger; it can send mail.
- `pauseAutomaticOutreach` / `resumeAutomaticOutreach`: control automatic sending.
- `stopDailyCheck`: pauses and removes the daily handler's trigger.
- `sendSelfTestEmail`: the manually requested self-test with a fixed duplicate-check token. The November 1 test was accepted and verified in the same mailbox's Inbox.
- `testRules`: checks the eligibility and email rules without sending.

The historic ten-recipient manual batch is replaced with a disabled stub in the working `Code.gs`. The original export, including that recipient list, is preserved as historical data in `../repeset/automation-history.zip` at the owner's request. The daily automation is preserved. The live Apps Script project was not changed for this archive.

## Local verification

Run `node verify.mjs` with Node.js 22 or newer. It parses the actual Apps Script source and exercises pure eligibility, quota, and scan-cursor behavior with mocked services. It does not access Gmail, contact FMCSA, or send email.

