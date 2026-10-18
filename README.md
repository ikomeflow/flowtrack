# FlowTrack

**Your money, in view.** Free, open-source income and expense tracking for young Africans and anyone building better money habits. An [Ikomeflow](https://ikomeflow.com) / Futura Group project, in minimal blue and white.

No signup, backend, external fonts, analytics, or runtime dependencies. A small web app using HTML, CSS and JavaScript. Published files are bundled and minified at build time; the app needs no runtime packages. MIT licensed.

Live app: [flowtrack.ikomeflow.com](https://flowtrack.ikomeflow.com/) · [Project page](https://ikomeflow.com/flowtrack/) · [GitHub source](https://github.com/ikomeflow/flowtrack)

See [WordPress integration notes](wordpress/INTEGRATION.md) for the current deployment and DNS configuration.

## Faster loading (1.11)

After the first complete download, reopening uses the saved matching HTML and app files immediately, even if the connection stalls. A new service worker downloads a complete update in the background. The existing Update button applies it together, after open forms are closed; an incomplete download keeps the old version available. No ledger key, PIN format, recovery route or encryption setting changed.

The theme bootstrap is included in the page and authorized with an exact CSP hash. One compact startup bundle replaces the previous module request chain. Optional device verification loads after the PIN gate can paint. Home prepares its own totals and recent entries; History and Calendar render when opened. History initially displays 100 matching transactions, with “Show 100 more”; searches and CSV/JSON exports still cover all records.

A controlled local test with 400 ms latency, 50 KB/s download and 4× CPU slowdown reached the PIN gate in **4.23 seconds before / 2.07 seconds after**. With the document network request stalled, the old reload did not finish within 2.5 seconds; the new cached reload opened in **0.39 seconds**. These are test-environment measurements, not a guarantee for every device or connection.

To rebuild the committed files, run `npm ci` then `npm run build`. Source is under `src/`; encryption and compatibility modules remain under `dist/`. Run `npm run check`, `npm test` and the optional browser suites described in TESTING.md. The GitHub workflow rebuilds before checking and deploying.

## What works

- **First use asks for PIN setup.** Choose 4 digits and confirm them to open the personal ledger. Recovery setup is optional in Settings. Existing unprotected records are preserved and remain unchanged until setup finishes. No PIN is set automatically; cancellation keeps the setup gate and original records. PIN protection cannot be turned off in the interface.
- Optional **Settings → PIN lock → Enable quick unlock**. Compatible platform passkeys use face recognition, fingerprint or the device screen-lock PIN. The browser chooses the method; FlowTrack does not receive biometric data. The FlowTrack PIN always remains available. After PIN creation, tap Enable in the brief optional offer, then confirm on the device. Settings uses the same direct flow. No repeated FlowTrack PIN entry is needed during a PIN-verified session; a session opened only with a passkey must verify the FlowTrack PIN before enrolling a replacement. The offer can be dismissed.
- The portfolio launches a named app tab at `/#overview`. A repeat click in the same browsing session can reuse that already-unlocked document without reloading. A closed/reloaded tab, 30 idle minutes, or Lock now requires verification again. If device unlock is enabled, opening a locked app or returning to its tab automatically requests device verification once. Cancellation or failure shows the PIN and a manual retry; focus changes do not repeatedly prompt. Manual Lock now stays locked until the user chooses to unlock or leaves and returns. Background tabs do not start verification. Browsers that block automatic verification retain the manual button. No unlocked key or PIN is saved to browser storage.
- **Forgot PIN → Recover PIN** uses a recovery key saved beforehand and preserves every record. Existing PIN users can add recovery from Settings after unlocking once. Recovering or changing a PIN keeps the existing recovery code. Only replacing a recovery key issues a fresh code to save.
- Light and dark modes from the sun/moon button. Follows the device appearance initially; an explicit choice is saved separately from the ledger, works offline, and synchronizes between tabs.
- Three main destinations: **Home, History and Settings**. On phones, Add is a separate action in the bottom navigation. Safe-area padding protects the iPhone home indicator, the month selector shares the Home heading row, and a readable caption opens the native month picker. Calendar controls stack on narrow screens; phone inputs use at least 16px text to avoid focus zoom. Home shows the monthly balance, smaller income/expense totals and five recent entries, without charts or extra cards.
- **+ Add** starts with amount and defaults to Expense. Description is optional; a blank description is saved as Expense or Income, keeping backups compatible. Date defaults to today; date and up to five tags stay under **More options**. One Save updates totals and closes the form. Tap an entry to edit it. Delete acts immediately and offers Undo for 30 seconds after the latest deletion; Undo restores the current batch of recent deletions, preserving other edits and additions. Undo is temporary in-memory state: locking, refreshing, importing, clearing, another tab changing the ledger, or switching demo mode discards it. Export backups regularly. Clear-all and restore still require confirmation.
- History searches descriptions/tags across all dates by default. New additions appear first within the same day, using ledger insertion order instead of random IDs. Type and month filters expand on demand. The calendar icon opens daily history; its back arrow returns to the list.
- Settings keeps currency visible, with PIN, installation, backup/export, clear-data and privacy details grouped into expandable rows. Sample data is available from Settings and never changes the personal ledger.
- African and global currency choices, default XAF. **Display only: changing currency relabels the whole ledger and never converts any amounts.** Each ledger has one currency. All currencies display two decimals for consistent entry; this is a personal tracker, not a payment processor.
- CSV export of all records or current search results, with spreadsheet-formula neutralization. JSON backup and validated restore.
- Browser-local persistence and a PWA app shell that works offline after the first successful online load. App-install support depends on the browser.
- Accessible labels, keyboard controls, full-row transaction buttons, semantic dialogs and reduced-motion support.

## Run locally

Install Node.js 20 or newer. No package installation or build is needed.

```sh
npm start
```

Open **http://127.0.0.1:4173**. Keep the server running during use. Do not double-click `index.html`: browsers restrict JavaScript modules and service workers on `file://` URLs.

```sh
npm run check
npm test
```

`tests/core.test.mjs` covers decimal arithmetic, totals, filters, dates, currency relabeling, backup integrity, limits and CSV escaping. See `TESTING.md` for browser checks and verification results.

## Publish with GitHub Pages

1. Create your own public GitHub repository, for example `flowtrack`.
2. Upload **the contents of this folder**, including `dist/` and `.github/workflows/pages.yml`, to the repository's `main` branch. Do not upload personal CSV/JSON files or test records.
3. In the repository, open **Settings → Pages → Build and deployment → Source → GitHub Actions**.
4. Open **Actions → Test and deploy FlowTrack**. Run it manually if it has not started. The workflow checks the app, runs tests, and publishes only `dist/`.
5. Wait for the deployment to succeed. The workflow exposes the actual live URL, normally `https://YOUR-USERNAME.github.io/flowtrack/`. Open that URL and test it before sharing.

All application paths, the manifest, start URL, cache and service-worker scope are relative, so repository subpaths work. A custom domain is optional. No API keys or environment variables are needed. The `.openai/hosting.json` file is only for the separate Sites preview and is not used by GitHub Pages; omit it when creating an independent project.

The workflow follows [GitHub's custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages). Your GitHub repository is not created or deployed by merely downloading these files.

## Link from ikomeflow.com

After GitHub Pages confirms deployment, add a portfolio card to ikomeflow.com with a launch link:

- **Open FlowTrack** → your verified live GitHub Pages URL.

Suggested copy: “A free, private income and expense tracker. No signup. Track your progress, even offline.” Open as a full page for the most reliable storage and installation experience. The wordpress/ folder contains the published project page markup and integration notes for ikomeflow.com.

## Privacy and backups — please read

Transactions live under `flowtrack.v1` in `localStorage`, scoped to this website origin and browser profile. Legacy unprotected records are readable without a PIN. Required PIN setup atomically replaces the plaintext ledger with authenticated ciphertext at the same key. The app sends no records or PINs to any server. Hosting providers can receive normal web request logs when serving the files.

PIN encryption uses the browser's [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey). A random 256-bit data key encrypts the ledger with AES-256-GCM and a fresh random 96-bit nonce per write. The PIN wraps that data key using another AES-GCM operation, with a 128-bit random salt and PBKDF2-HMAC-SHA-256 at 600,000 iterations; the derivation cost follows [OWASP's PBKDF2 guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). If optional recovery is configured, an independent random 256-bit recovery key wraps the data key through a separate authenticated role. Only ciphertext and wrapped keys are persisted. During a PIN-verified session, the non-extractable PIN wrapping CryptoKey remains in memory to authorize optional device enrollment. Locking discards it; it is never stored in browser storage. PINs, recovery secrets and unwrapped keys are not saved in local storage; non-extractable CryptoKeys remain in memory while unlocked.

PIN creation and changes commit immediately after confirmation, without a recovery-key screen. Optional recovery is configured separately in Settings and is committed only after the user acknowledges saving its code. No secret recovery route is silently created. Cancellation, quota failures and concurrent changes preserve the old ledger. PIN changes and code-based resets rewrap the existing data key, preserving configured recovery/device routes; the recovery code stays valid. A copied old PIN wrapper can therefore still access the same data key if an attacker already holds that wrapper and its PIN. Replacing recovery or removing device unlock rotates the data key and revokes the previous routes for current data. Old backups retain their own credentials. Recovery works offline after caching and cannot be added retroactively to a forgotten locked PIN. The app locks after 30 minutes without interaction, or immediately on manual lock, reload or closing the page. No unlocked encryption key is persisted between documents.

Changing or disabling protection requires the current PIN; forgotten-PIN reset requires the matching recovery key. Locking clears the rendered ledger and working state, discards the key and staged setup, and closes unfinished dialogs; unsaved drafts are lost. Manual locking signals other tabs. Another tab changing the protected ledger locks this tab.

Version 1.10 requires PIN setup for personal use. Device unlock uses the [WebAuthn PRF extension](https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API/WebAuthn_extensions#prf): a platform credential, required user verification, a random 256-bit input, and a credential-derived 256-bit secret wrap the ledger's actual data key with AES-GCM. Credential ID, RP ID, PRF input and wrapped ciphertext are saved; the PRF result and raw data key are not. Assertion challenge, origin, credential ID, RP hash, user-presence and user-verification flags are checked before accepting the PRF result. There is no server account or server authentication session; successful authenticated decryption is the local access check.

Device unlock needs both a platform authenticator and PRF support. Unsupported, cancelled or failed enrollment leaves PIN/recovery access and stored records unchanged. Registration may require two device confirmations. A passkey created before an unsupported or cancelled second step may remain in the device's credential manager; the app does not gain an unlock route unless encrypted setup succeeds. Passkey providers may sync credentials; **the ledger does not sync**. Never promise facial recognition specifically: the platform may use fingerprints, a device PIN or another supported verification method. See [Google's user-verification explanation](https://web.dev/articles/webauthn-user-verification).

Replacing recovery or removing device unlock issues a new recovery code and removes the old device wrapper; save that code and re-enable quick unlock if desired. PIN changes and recovery resets keep configured routes. Removing a device route does not delete the passkey from the operating system. Damaged optional device metadata is ignored so PIN/recovery access remains available. Legacy vault APIs remain for compatibility tests; the current UI uses the simpler flow.

**A local privacy lock has limits.** A short numeric PIN can be guessed offline by someone who obtains the locked file; UI delays cannot prevent that attack. A recovery key grants access to its matching ledger, so store it separately and privately. This does not protect an unlocked browser, malicious extensions, malware, or compromised same-origin JavaScript, and cannot securely erase earlier plaintext from disk history or backups. Protect the device itself; the app uses a four-digit PIN. Without the PIN, a matching recovery key saved beforehand, or a separate normal JSON backup, encrypted records cannot be recovered.

Normal JSON backups and CSV exports are **unencrypted**, including when PIN lock is on. Keep them private. A locked copy is restorable with its matching PIN or recovery key; older copies keep their own keys. The destructive device reset is separate from key-based PIN recovery, requires confirmation and erases records; a separate normal JSON backup can then restore them. Cancellation preserves the original.

There is no recovery service, account, cross-device sync or cloud backup. Clearing browser/site data, private browsing, device loss or browser cleanup can erase records. Moving between localhost, GitHub Pages, a custom domain or a different browser creates a separate ledger. Use **Settings → Back up** regularly, keep the JSON file privately, and restore it on the new address or device. CSV is for spreadsheets, not restoration. Protect downloaded exports: they contain readable financial data.

Storage failures show a visible notice. If storage is unavailable, unprotected records last only for the open session and PIN setup is unavailable. Protected saves fail without replacing the ciphertext. Quota failures and concurrent changes reject the pending write. Unreadable data is preserved and blocks edits; download the original using Settings, then restore a known-good backup. Restore and clear actions require confirmation. JSON restores replace the ledger. Imports are limited to 32 MB and 50,000 entries; amounts use integer hundredths with safe-total checks.

Use a dedicated origin for financial records if hosting other apps. All pages on the same origin can technically access its browser storage. FlowTrack is a personal record keeper; its monthly net is not a bank-account balance.

## Offline use and updates

Version 1.12 uses `app-v14.mjs`, `styles-v11.css`, `vault-v8.mjs` and `device-v1.mjs` so older offline installations never mix a cached old script with new markup. Future incompatible shell releases need new asset filenames and a new service-worker cache version. Normal JSON backups retain the version-1 ledger schema. New protected storage uses a version-2 `flowtrack-vault` envelope; version-1 protected ledgers remain readable with their original PIN and can migrate through Settings. Do not downgrade a protected installation. The theme uses the separate `flowtrack.theme` key and is not part of backups. GitHub remains the public development repository; the user-facing app and portfolio page omit source-code links.

Serve over HTTPS (or localhost). After the initial successful visit and service-worker activation, the local app shell is cached. The PIN screen and Settings report whether offline files are ready. The small PIN stylesheet is inline; the full workspace stylesheet loads after startup. Interrupted downloads expose Retry without changing the ledger. If an older cached copy is stuck before the PIN, open https://flowtrack.ikomeflow.com/open.html on the same browser and choose Update app if offered. This same-origin entry preserves existing browser records; do not clear site data. A first visit without internet cannot work. Installation does not create a cloud backup. Browser installation UX varies; Safari on iPhone/iPad supports Share → Add to Home Screen.

The app checks for service-worker updates during visits. A banner offers to apply a waiting update. When editing the shell, change the `CACHE` version in `dist/sw.js`. Do not reuse a cache name for different app releases. JSON backups remain compatible as long as the schema stays at version 1. See [MDN's service-worker guide](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers).

## Project layout

```text
dist/                 Publish this folder, as-is
  index.html          Responsive UI and accessible dialogs
  styles-v11.css      Minified light/dark visual system
  app-v14.mjs          Bundled PIN, UI, downloads, PWA
  vault-v8.mjs        Encrypted storage, device key wrapping, recovery
  device-v1.mjs       Platform WebAuthn PRF and verification checks
  theme.js            Legacy appearance bootstrap (current theme is inline)
  core-v2.mjs         Current validation, exact amounts, insertion-order history, CSV
  core.mjs            Compatible shared validation for existing vault modules
  sw.js               Versioned offline shell
  manifest.webmanifest, icon*   Installation metadata/assets
src/                  Readable app, styles and HTML build template
build.mjs             Reproducible bundle, stylesheet and HTML build
tests/                Unit and optional browser tests
.github/workflows/    Tests and GitHub Pages deployment
server.mjs            Dependency-free local preview server
LICENSE               MIT
```

## Contributing

Keep the app lightweight, usable on small screens and honest about privacy. Avoid adding tracking, mandatory registration or network dependencies. Run checks and tests, then verify mobile, offline and backup flows before proposing changes. Never commit real financial records.



New and reset PINs use exactly four digits. Existing 6–12 digit PINs still unlock their original records and backups; change them in Settings → PIN lock → Change PIN. Existing PINs are never truncated.

