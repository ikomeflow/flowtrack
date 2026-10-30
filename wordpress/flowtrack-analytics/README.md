# FlowTrack Analytics

Install this directory as a WordPress plugin on **ikomeflow.com**. Activate it and open **FlowTrack Analytics** in the admin menu. Only users with `manage_options` can read the dashboard. Its refresh endpoint requires both that permission and a WordPress nonce. The frontend is the existing static FlowTrack app, with no subscriptions or registration added.

## Collection

`POST https://ikomeflow.com/wp-json/flowtrack-analytics/v1/collect` accepts only the exact origin `https://flowtrack.ikomeflow.com`, a body of at most 1 KiB, and exactly six fields: version, event ID, random visitor ID, random session ID, a fixed event name and a fixed screen name. Unknown fields and invalid IDs are rejected. Browser requests omit cookies, credentials and referrers. No secret belongs in the browser. Collection is public and cannot cryptographically prove an event is human; Origin is browser protection, not authentication. Statistics are estimates.

The app defaults to off. Equal-weight Allow and No thanks controls explain the choice. Settings → Privacy & backups contains the toggle. Do Not Track and Global Privacy Control override consent. Revoking consent removes browser/session identifiers across tabs. The client never reads ledger data for analytics. Browser identifiers rotate after 30 days; sessions are shared across tabs and renew after 30 minutes without a sent event. Heartbeats run approximately once a minute only on visible online pages with interaction in the last five minutes. No offline queue or retry/backfill exists.

## Definitions and retention

- Daily active users: distinct participating anonymous browsers with an event today, in the configured WordPress timezone. This is not an account/person total.
- Live active users: distinct browsers whose latest received event is within five minutes. Closing the app can take five minutes to disappear; timers/ad blockers reduce accuracy.
- Sessions today: distinct session IDs seen today. A session spanning midnight appears on both days.
- App activity: successful transaction create/update/delete, backup download/restore, PDF export, app opens and fixed screen views. Demo ledger actions are excluded from financial feature events. No amounts, descriptions, tags, transaction IDs, dates, PINs, keys, emails, URLs, referrers or user agents are accepted.

WordPress stores only salted hashes of random identifiers, event/screen names, reception timestamps and local calendar days. Data older than 30 days is excluded from every query and removed by an hourly WP-Cron hook. Rate limiting stores minute-specific salted IP buckets (no raw IPs): 120 requests/minute/source address and 100,000/day globally; buckets are cleaned hourly. Hosts may keep normal access logs. Public endpoints are susceptible to fabricated traffic, and shared networks may be throttled.

## Deployment and rollback

Deploy the WordPress plugin first on Hostinger. FlowTrack's static frontend is served by GitHub Pages from `ikomeflow/flowtrack`; commit the tested frontend and source to its existing main branch to trigger the existing test-and-deploy workflow. Keep older app assets so installed/offline copies continue working. The service worker downloads a complete cache under `v24-20261030-analytics`; existing clients can use the app's Update button. No records, database account tables, signing keys, SMTP setup or paused subscriptions need changing.

Rollback by restoring the saved pre-update `index.html`, `open.html` and `sw.js` and deactivating this plugin. Do not clear visitor site data. Deactivation stops collection/dashboard routes and unschedules cleanup; existing analytics remain in the WordPress database. If you keep the plugin deactivated, retention cleanup also stops. Do not leave retained analytics indefinitely after uninstalling.

## Validation

Run `npm run build`, `npm run check`, `npm test`, and `php tests/analytics-collector.php`. Browser QA should confirm both consent choices, the settings toggle, successful events, admin report changes, no analytics requests while declined, and offline app continuity. Verify unauthenticated dashboard refresh is denied, foreign Origin and unexpected private fields are rejected, and duplicate event IDs are ignored. Use a disposable local browser ledger for write/export tests; never alter an existing user's ledger for QA.
