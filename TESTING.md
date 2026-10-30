# Hostinger subscription release — local verification, 30 October 2026

54 Node app tests, 25 PHP service checks, four SMTP checks and 11 HTTP security checks passed locally. Build and syntax checks passed. The PHP checks use a disposable SQLite database and PHP 8.5. Hostinger accepted the six-table MySQL schema and owner registration. Nine hosted security checks passed, including HTTPS cookies, exact CORS, CSRF and anonymous access denial. The account-only page was deployed by Actions run 41085758164 and opened publicly. PHP email sending failed; authenticated SMTP support is installed pending a private sending credential and inbox verification. The main subscription release and payments are not activated.

Chrome confirmed synthetic registration/email confirmation/sign-in; explicit ledger linking; trial editing; 600 XAF MTN payment submission; pending status without access extension; session-bound admin email-code verification; approval and restored paid access; expired editing blocked with all records visible; PDF and JSON downloads containing the three test records; a staged service-worker update without record loss; and cached reopening plus saving a fourth entry after both local servers were stopped. Account-switch and confirmation-link handling issues found during review were fixed. Real MTN payments and physical devices were not used.

Run `npm test`, `npm run build`, `npm run check`; PHP backend checks: `php tests/hostinger-backend.php` with OpenSSL and PDO SQLite enabled. `tests/hostinger-review.mjs` starts an isolated local fixture; `tests/hostinger-http.mjs` checks its HTTP controls. The fixture uses synthetic accounts and a private file outbox; never deploy test-results or fixture keys.

# Version 1.14.0 — PDF history and visible tags

Build and syntax checks passed. All 51 unit tests passed, including new PDF structure, font embedding, pagination beyond 100 results, cancellation after a ledger change, and offline caching of the PDF module. The existing PIN, recovery, device and calculation tests remain green.

Chrome checks on a separate local origin with synthetic encrypted records: a real 120-entry PDF download, a 20-entry search download, no-result export disabled, visible tags in the add/edit form, wrapping five-tag rows, and narrow phone layout without horizontal scrolling. An independent PDF reader verified all entries, search scope, totals, accented text, repeated table headers and page numbers. Rendered first/continuation pages were visually checked, including local CJK/emoji fallback. No real financial records were created or changed. JSON backup/restore remains separate from PDF history.

PDF creation and the bundled font work without external service requests. The PDF code loads on demand and is part of the offline shell. Scripts not covered by the embedded font are preserved visually with local system-font images; those specific text runs are not selectable. The optional browser and performance suites now expect PDF downloads and visible tag input; these full suites were not rerun for this release.

# Version 1.13.1 — lighter downloads for slow connections

The visible app files are cached before installation icons and optional tools. New script and stylesheet filenames keep old offline versions coherent. PNG icons use lossless compression with identical decoded pixels. Records, PIN protection, recovery, calculations and exports are unchanged.

Controlled test: 50 kbit/s shared download, 1.2 s response delay per request, gzip, isolated fresh browser profile. First complete download changed from 59,179 to 53,339 bytes (about 10% less). PIN screen: 6.06 to 5.74 seconds; full styles: 9.77 to 9.29 seconds. Ready offline: 13.42 to 13.29 seconds; saved offline reopening: 0.24 seconds. These controlled measurements are not a promise for every real 2G network. Prioritizing the screen may slightly delay full offline setup.

# Version 1.13.0 — installable Futura Group app

Added installation help on the PIN screens and in Settings, native prompt handling, standalone detection, install icons and an updated offline shell. Ledger, PIN and recovery storage remain unchanged.

Validation: build and syntax checks passed; 47 unit tests and 24 isolated browser installation checks passed. The browser checks cover prompt acceptance/cancellation, unchanged storage, iPhone guidance, standalone detection, mobile layout, Settings discovery, and offline reopening. Chromium reported no app-side installability errors; the private test context itself cannot perform actual installation.

# Version 1.12.2 — Futura Group producer branding

App credits and producer metadata identify Futura Group. Settings and social previews use the same credit; the new preview has a fresh URL. Offline cache version updated. App addresses, storage keys, PINs, recovery settings and records are unchanged.

# Version 1.12.1 — Ikomeflow branding and consistent loading colors

Public app credits use Ikomeflow. PIN screens have no creator byline. Critical loading colors now match the fully loaded light/dark palette, so the primary blue and background do not change as workspace styles arrive. No storage, security, calculation or export logic changed.

Verified across both apps: 50 isolated browser checks passed for light/dark colors before and after workspace styles, mobile/desktop layout, creator credits, blank PIN bylines, exact ciphertext preservation and absence of browser errors. Both six-test service-worker suites passed. The new FlowTrack share image was rendered from its SVG and inspected.

## Version 1.12 startup reliability verification — 17 October 2026

- **47 unit tests and 224 browser assertions passed**: 59 general, 24 PIN, 19 recovery, 29 virtual-device, 55 mobile, 22 performance/upgrade and 16 startup/failure checks. Synthetic records and isolated profiles only.
- In the controlled gzip comparison (400 ms latency, 50 KB/s, 4× CPU slowdown), the previous 1.11 PIN gate appeared at 1931 ms and 1.12 at 1602 ms, about 17% faster. Cached stalled-connection reloads completed at 309 ms and 282 ms respectively. These timings describe this test run, not every network.
- The PIN gate remains usable with the full workspace stylesheet deliberately stalled. Authenticated content waits for styling; it resumes when CSS arrives. Widths 320, 390, 768 and 1440 have no horizontal overflow.
- Failed main-script and stylesheet downloads expose working Retry controls. Offline installation failures can be retried while locked. Status and Update app are visible before unlocking.
- The same-origin open.html entry bypasses the exact previous release's cached root. Applying its update preserves stored ciphertext byte-for-byte and returns to the canonical root. Partial PIN entry blocks update reload. The entry also works offline after the new cache is installed.
- Previous-release upgrade checks preserve all 250 encrypted records, complete CSV output, open-draft guards and failed-candidate fallback. PIN, recovery and device protection modules are unchanged. Physical Safari/iOS and real biometric hardware were not tested.
- Run `node tests/startup-browser.mjs` for the new loading/failure suite and `node tests/performance-browser.mjs` for the isolated prior-release comparison.

## Version 1.11 performance verification — 17 October 2026

- **47 unit tests**: 41 existing calculation, storage, PIN, recovery and device tests plus six service-worker tests.
- **236 browser assertions** passed: 59 general, 24 PIN, 19 recovery, 29 virtual-device, 55 mobile, 28 fast-entry/Undo and 22 performance/upgrade checks. Tests use disposable browser contexts and synthetic records; no production ledger or real credential was used.
- Slow connection comparison: 400 ms latency, 50 KB/s download, 4× CPU slowdown, gzip responses on a local test server. PIN gate: old 4227 ms, new 2069 ms. Stalled document reload: old timed out at 2510 ms, new completed at 392 ms without requesting the document from the network. Measurements are specific to this controlled run.
- A cached previous-release installation downloads the candidate in the background, keeps the old cache while waiting, refuses updating with an open draft, and applies coherent HTML/code on explicit Update. Stored ciphertext stayed byte-for-byte identical; the old PIN opened all 250 records.
- A failed candidate asset download removes only the incomplete cache. The previous app and PIN-protected ledger remain usable offline.
- Home does not construct hidden History or Calendar. History starts with 100 rows, expands on demand, searches all 250 fixture rows and exports all 250 rows to CSV. Locking clears transaction text, and all records unlock offline.
- Optional device verification still supports automatic foreground verification, cancellation without repeated prompts, PIN fallback and offline use. Device tests use a synthetic authenticator; physical iOS/Android authentication was not tested.
- Run the optional performance suite with `node tests/performance-browser.mjs` alongside the existing browser suites; it starts its own isolated local comparison server.

# Verification

Verified on 16 October 2026 in headless Microsoft Edge (Chromium) on Windows. No live deployment is implied by these local results.

## Automated checks

- Version 1.10: 41 unit tests and 142 browser assertions passed (59 general, 28 fast Add/Undo and 55 phone-layout checks). Phone checks cover widths 320, 360, 375, 390 and 430, the bottom Add action, a single heading/month row, expanded filters/settings, calendar controls, input text sizes, Undo above navigation, scrolling to the last entry and large amounts. Same-day additions now appear before older entries regardless of random IDs. Light/dark Home, History, Calendar and Settings were visually reviewed. Phone tests use Chromium with touch/mobile emulation and an iPhone viewport/user agent; a physical iPhone, Safari/WebKit and its native keyboard/picker were not available for testing.

- Version 1.9: 40 unit tests and 111 browser assertions passed (59 general, 24 PIN and 28 fast Add/Undo checks). Amount-only entries keep the existing backup schema using Expense/Income labels. Coverage includes rapid double submission, exact batch restoration, newer edits/additions surviving Undo, quota failures and retry, 30-second expiry, clearing temporary Undo on lock or demo changes, cross-tab changes, and offline Add/Undo/reload. Light and dark Add forms and Undo were visually reviewed at 320px; the general suite also checked widths 375, 768 and 1024. Tests use synthetic records in isolated browser contexts.

- Version 1.5.1: 34 unit tests and 121 browser assertions passed with four-digit PINs. New/reset PIN validation rejects shorter and longer values; leading zeros work. Previous six-digit v2 PINs unlock unchanged records and can change to four digits. Legacy v1 recovery migration, offline unlock/reset and virtual-device unlock also passed.

- Version 1.5: 33 unit tests and 121 browser assertions passed (59 general, 23 PIN, 19 recovery and 20 device/required-setup checks). Device checks use Chromium's real WebAuthn API with a synthetic CTAP2.1 platform authenticator supporting PRF, not actual user credentials. They verify encrypted enrollment/unlock, PIN fallback, a reused unlocked app tab, new-document locking, offline device unlock, removal cancellation/key rotation, and an authenticator without PRF. Cancellation is simulated by a standard NotAllowedError. Real Face ID, fingerprints and Windows Hello hardware have not been enrolled or tested.
- Version 1.4: 25 unit tests and 101 browser assertions passed (59 general, 23 PIN and 19 recovery). The general suite now checks three primary destinations, the chart-free home, amount focus, today's default date, and date/tags behind More options, plus row editing, confirmed deletion, search, calendar, currency changes, actual downloads, backup/restore, storage failures, responsive widths, themes, cross-tab changes and offline entry. Disclosure controls are exercised through visible UI. No runtime errors occurred.
- Version 1.4: desktop light/dark and 390px mobile layouts were visually reviewed. The original v1 offline installation successfully upgraded to the minimal shell with exact ledger and theme preservation.
- Version 1.4: a cached v1.3 installation with a synthetic encrypted ledger upgraded to the new shell, preserved its exact stored ciphertext and dark theme, then successfully reset its PIN offline using the previously saved recovery key without losing any record.
- Version 1.3: 25 unit tests and 96 browser assertions passed (54 general, 23 PIN and 19 recovery). Coverage includes staged recovery setup/cancellation, latest-record preservation after reset, wrong-key rejection, fresh data/recovery keys after PIN changes, legacy PIN migration, quota failures, stale writes and old-wrapper rejection. Browser tests used synthetic ledgers in isolated Edge contexts; no normal browser records or real credentials were used.
- Version 1.3: the real v1 service-worker-to-current upgrade passed with exact record/theme preservation and offline reopening. No browser runtime errors were detected.
- Version 1.2: 17 unit tests passed, including ciphertext round trips, wrong PINs, tampering, nonce freshness, lock cancellation of pending writes, PIN changes/removal, quota failure, stale tabs, locked-copy restore and malformed input.
- Version 1.2: the full 54-assertion general browser suite and 23 additional PIN browser assertions passed. PIN checks cover setup mismatch, local encryption, locking and DOM clearing, reopening, wrong/correct PINs, encrypted writes, backup/restore, cross-tab locking, PIN change/removal, five-minute automatic locking, offline unlock, a 320px screen, recovery-copy download, reset cancellation/confirmation and locked-copy restoration. All records were synthetic in an isolated browser profile.
- The v1-to-current service-worker upgrade check also passed with exact ledger preservation and offline reopening. Device-specific keyboards, real screen readers and slow-device key-derivation performance have not been audited.
- Version 1.1: all 9 unit tests and 54 browser assertions passed. New coverage checks dark/light surfaces, saved preferences after reload, exact ledger preservation, themed transaction inputs, offline appearance, device preference, explicit overrides, cross-tab theme sync, and switching themes when storage is blocked.
- Upgrade check: a real v1 service-worker installation was updated to v2 with a synthetic ledger; the new interface loaded before worker activation, the update banner applied, and exact records plus the theme survived an offline reload without runtime errors.
- JavaScript syntax checks for the app, shared core and service worker.
- 9 Node unit tests: exact decimal amounts, month totals, search and filters, valid calendar dates, JSON round trips, malformed backups, transaction validation, CSV safety and currency relabeling.
- 43 browser assertions: empty state; add/edit/delete/cancel; reload persistence; combined search and type filters; calendar; currency confirm/cancel; actual JSON and CSV downloads; clear and restore; invalid-restore preservation; demo isolation; all four views at widths 320, 375, 768 and 1024; 390px mobile layout; offline reload and entry; cross-tab refresh; corrupt-data preservation; storage-disabled notice; no JavaScript runtime errors.
- The complete 43-assertion browser suite also passed with the app served at `/flowtrack/`, including scoped service-worker installation and offline reload, matching a GitHub Pages project path.
- Desktop (1440px) and mobile (390px) screenshots visually reviewed.

## Run again

```sh
npm run check
npm test
```

The app and unit tests need no installed packages. For the optional browser suite, install Playwright and its Chromium browser in your development environment:

```sh
npm install --no-save playwright
npx playwright install chromium
npm start
```

In a second terminal:

```sh
node tests/browser.mjs
node tests/pin-browser.mjs
node tests/recovery-browser.mjs
node tests/device-browser.mjs
node tests/fast-add-browser.mjs
node tests/mobile-browser.mjs
```

The browser suite creates temporary, synthetic financial records in an isolated browser context, downloads test backups and writes screenshots under ignored `test-results/`. It never reads your normal browser profile. It expects port 4173 unless `FLOWTRACK_QA_URL` is set. `FLOWTRACK_QA_BROWSER` optionally selects a locally installed Chromium/Edge executable. In environments with a shared package bundle, `FLOWTRACK_QA_PACKAGE_ROOT` can point to that bundle's Node package root.

## Release checks

- Open the published URL over HTTPS, add a synthetic record, reload, then remove it.
- Test actual installation on Android Chrome and iOS Safari. These device-specific install flows have not been tested here.
- Load online until Settings confirms offline readiness; disconnect and reopen the app.
- Download and restore a JSON backup before using real records.
- When changing app-shell files, increment the service-worker cache version and test the update banner.
- Validate GitHub Pages using the provided workflow on your own repository. GitHub publication and the ikomeflow.com portfolio link are separate deployment steps.

The core uses safe integer hundredths, not floating-point totals. Personal use requires a PIN and records are encrypted locally; browser storage is never a guaranteed backup. Optional recovery must be configured and its key saved before the PIN is forgotten. Undo is temporary and expires 30 seconds after the latest deletion, or on lock, refresh, ledger replacement or demo changes. Accessibility semantics and keyboard controls are present; a full screen-reader audit and real-device testing remain recommended.
