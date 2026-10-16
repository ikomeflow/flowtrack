# FlowTrack

**Your money, in view.** Free, open-source income and expense tracking for young Africans and anyone building better money habits. An [Ikomeflow](https://ikomeflow.com) / Futura Group project, in minimal blue and white.

No signup, backend, external fonts, analytics, or runtime dependencies. A small, buildless web app using HTML, CSS and JavaScript modules. MIT licensed.

Live app: [flowtrack.ikomeflow.com](https://flowtrack.ikomeflow.com/) · [Project page](https://ikomeflow.com/flowtrack/) · [GitHub source](https://github.com/ikomeflow/flowtrack)

See [WordPress integration notes](wordpress/INTEGRATION.md) for the current deployment and DNS configuration.

## What works

- Optional **Settings → PIN lock**. Choose 6–12 digits and save the generated recovery key before setup finishes. Protected ledgers lock on reopening, after five idle minutes, or with Lock now. No PIN is set automatically.
- **Forgot PIN → Reset PIN** uses a recovery key saved beforehand and preserves every record. Existing PIN users can add recovery from Settings after unlocking once. A new PIN or a replacement recovery key issues a fresh key to save.
- Light and dark modes from the sun/moon button. Follows the device appearance initially; an explicit choice is saved separately from the ledger, works offline, and synchronizes between tabs.
- Three main destinations: **Home, History and Settings**. Home shows the monthly balance, smaller income/expense totals and five recent entries, without charts or extra cards.
- **+ Add** opens income/expense, amount and description. Date defaults to today; date and up to five tags live under **More options**. Tap an entry to edit it; Delete is in the edit dialog and requires confirmation.
- History searches descriptions/tags across all dates by default. Type and month filters expand on demand. The calendar icon opens daily history; its back arrow returns to the list.
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

Transactions live under `flowtrack.v1` in `localStorage`, scoped to this website origin and browser profile. They are readable without a PIN. Enabling the optional PIN atomically replaces the plaintext ledger with authenticated ciphertext at the same key. The app sends no records or PINs to any server. Hosting providers can receive normal web request logs when serving the files.

PIN encryption uses the browser's [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey). A random 256-bit data key encrypts the ledger with AES-256-GCM and a fresh random 96-bit nonce per write. The PIN wraps that data key using another AES-GCM operation, with a 128-bit random salt and PBKDF2-HMAC-SHA-256 at 600,000 iterations; the derivation cost follows [OWASP's PBKDF2 guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). An independent random 256-bit recovery key wraps the data key through a separate authenticated role. Only ciphertext and wrapped keys are persisted. PINs, recovery secrets and unwrapped keys are not saved in local storage; non-extractable CryptoKeys remain in memory while unlocked.

PIN setup, migration and recovery reset are staged in memory. The old stored ledger remains unchanged until the user acknowledges saving the new recovery key and finishes. Cancellation, quota failures or concurrent changes preserve the old ledger. PIN changes, recovery-key replacement and recovery resets rotate the data key as well as the recovery key, so copying a prior key wrapper into the current ledger cannot recover the new data. Old backup copies still retain their own credentials and readable historical records. Recovery works offline after the app is cached, without email, an account or a backend. Legacy version-1 PIN vaults need the known PIN once to migrate and add recovery; it cannot be retroactively added to a forgotten locked PIN.

Changing or disabling protection requires the current PIN; forgotten-PIN reset requires the matching recovery key. Locking clears the rendered ledger and working state, discards the key and staged setup, and closes unfinished dialogs; unsaved drafts are lost. Manual locking signals other tabs. Another tab changing the protected ledger locks this tab.

**A local privacy lock has limits.** A short numeric PIN can be guessed offline by someone who obtains the locked file; UI delays cannot prevent that attack. A recovery key grants access to its matching ledger, so store it separately and privately. This does not protect an unlocked browser, malicious extensions, malware, or compromised same-origin JavaScript, and cannot securely erase earlier plaintext from disk history or backups. Prefer a longer, unpredictable PIN and protect the device itself. Without the PIN, a matching recovery key saved beforehand, or a separate normal JSON backup, encrypted records cannot be recovered.

Normal JSON backups and CSV exports are **unencrypted**, including when PIN lock is on. Keep them private. A locked copy is restorable with its matching PIN or recovery key; older copies keep their own keys. The destructive device reset is separate from key-based PIN recovery, requires confirmation and erases records; a separate normal JSON backup can then restore them. Cancellation preserves the original.

There is no recovery service, account, cross-device sync or cloud backup. Clearing browser/site data, private browsing, device loss or browser cleanup can erase records. Moving between localhost, GitHub Pages, a custom domain or a different browser creates a separate ledger. Use **Settings → Back up** regularly, keep the JSON file privately, and restore it on the new address or device. CSV is for spreadsheets, not restoration. Protect downloaded exports: they contain readable financial data.

Storage failures show a visible notice. If storage is unavailable, unprotected records last only for the open session and PIN setup is unavailable. Protected saves fail without replacing the ciphertext. Quota failures and concurrent changes reject the pending write. Unreadable data is preserved and blocks edits; download the original using Settings, then restore a known-good backup. Restore and clear actions require confirmation. JSON restores replace the ledger. Imports are limited to 32 MB and 50,000 entries; amounts use integer hundredths with safe-total checks.

Use a dedicated origin for financial records if hosting other apps. All pages on the same origin can technically access its browser storage. FlowTrack is a personal record keeper; its monthly net is not a bank-account balance.

## Offline use and updates

Version 1.4 uses `app-v5.mjs`, `styles-v5.css` and the unchanged `vault-v4.mjs` so older offline installations never mix a cached old script with new markup. Future incompatible shell releases need new asset filenames and a new service-worker cache version. Normal JSON backups retain the version-1 ledger schema. New protected storage uses a version-2 `flowtrack-vault` envelope; version-1 protected ledgers remain readable with their original PIN and can migrate through Settings. Do not downgrade a protected installation. The theme uses the separate `flowtrack.theme` key and is not part of backups. GitHub remains the public development repository; the user-facing app and portfolio page omit source-code links.

Serve over HTTPS (or localhost). After the initial successful visit and service-worker activation, the local app shell is cached. Settings reports whether offline files are ready. A first visit without internet cannot work. Installation does not create a cloud backup. Browser installation UX varies; Safari on iPhone/iPad supports Share → Add to Home Screen.

The app checks for service-worker updates during visits. A banner offers to apply a waiting update. When editing the shell, change the `CACHE` version in `dist/sw.js`. Do not reuse a cache name for different app releases. JSON backups remain compatible as long as the schema stays at version 1. See [MDN's service-worker guide](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers).

## Project layout

```text
dist/                 Publish this folder, as-is
  index.html          Responsive UI and accessible dialogs
  styles-v5.css       Minimal light/dark visual system
  app-v5.mjs          Minimal UI, PIN recovery, downloads, PWA
  vault-v4.mjs        Encrypted storage, staged recovery and migration
  theme.js            Appearance preference before rendering
  core.mjs            Validation, exact amounts, filtering, CSV
  sw.js               Versioned offline shell
  manifest.webmanifest, icon*   Installation metadata/assets
tests/                Node unit tests
.github/workflows/    Tests and GitHub Pages deployment
server.mjs            Dependency-free local preview server
LICENSE               MIT
```

## Contributing

Keep the app lightweight, usable on small screens and honest about privacy. Avoid adding tracking, mandatory registration or network dependencies. Run checks and tests, then verify mobile, offline and backup flows before proposing changes. Never commit real financial records.

