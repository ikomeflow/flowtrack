# Verification

Verified on 16 October 2026 in headless Microsoft Edge (Chromium) on Windows. No live deployment is implied by these local results.

## Automated checks

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
```

The browser suite creates temporary, synthetic financial records in an isolated browser context, downloads test backups and writes screenshots under ignored `test-results/`. It never reads your normal browser profile. It expects port 4173 unless `FLOWTRACK_QA_URL` is set. `FLOWTRACK_QA_BROWSER` optionally selects a locally installed Chromium/Edge executable. In environments with a shared package bundle, `FLOWTRACK_QA_PACKAGE_ROOT` can point to that bundle's Node package root.

## Release checks

- Open the published URL over HTTPS, add a synthetic record, reload, then remove it.
- Test actual installation on Android Chrome and iOS Safari. These device-specific install flows have not been tested here.
- Load online until Settings confirms offline readiness; disconnect and reopen the app.
- Download and restore a JSON backup before using real records.
- When changing app-shell files, increment the service-worker cache version and test the update banner.
- Validate GitHub Pages using the provided workflow on your own repository. GitHub publication and the ikomeflow.com portfolio link are separate deployment steps.

The core uses safe integer hundredths, not floating-point totals. Browser local storage is neither encrypted nor a guaranteed backup. Accessibility semantics and keyboard controls are present; a full screen-reader audit and real-device testing remain recommended.
