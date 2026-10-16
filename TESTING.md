# Verification

Verified on 16 October 2026 in headless Microsoft Edge (Chromium) on Windows. No live deployment is implied by these local results.

## Automated checks

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
