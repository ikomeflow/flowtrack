# FlowTrack dashboard — 1.18.0

The mobile Home screen follows the supplied dashboard reference with a blue monthly balance card, income and expense summaries, recent transaction icons, and Home / Transactions / Add / Reports / Settings navigation. Existing desktop navigation, PIN gates, currency selection, calendar, history search and PDF downloads remain available. Balance means the selected month's income minus expenses; the comparison shows the absolute change from the preceding month, without inventing a percentage.

Reports read the existing ledger and show monthly totals, six months of income and expenses, and expense totals grouped by each entry's first tag. Untagged entries have their own group. The chart has a readable amounts table. Financial values continue to use integer minor units and the saved currency. Opening reports or navigating months does not save or migrate the ledger. Locking clears rendered report amounts and tag names.

## Data and offline safety

- Production origin remains `https://flowtrack.ikomeflow.com/` on the existing GitHub Pages project. No DNS, storage origin or WordPress changes.
- Ledger key, schema, encryption, PIN, recovery and device-unlock modules are unchanged. No user data is added to source or sent to deployment.
- FT icon and manifest are unchanged. Prior generated app and style assets remain available for older cached releases.
- New `app-v22.mjs` and `styles-v16.css` are installed as a complete offline shell before users activate the existing Update app action. Interrupted installation retains the working prior shell.
- Reports do not extend analytics collection or change consent. Unknown report screen events remain excluded by the existing allowlist.

## Validation

- Build and syntax checks pass. All 92 automated tests pass, including four new report tests for month boundaries, exact amounts, single-count tag grouping and preservation of plaintext/encrypted ledger bytes.
- Local browser checks: Home, Transactions, Reports and Settings at 320, 390, 768 and 1440 pixels; light/dark appearance, central Add, income/expense saving, history search, report month changes, accessible chart table and clearing rendered report data on lock.
- Upgrade rehearsal starts with the actual current release (`0202bc0f82b220524f5719fe7cc42c9770345edb`), creates a disposable encrypted record, then activates this release through the existing Update app button. Downloaded locked copies before and after are byte-identical (562 bytes; SHA-256 `027aa1969334ad3ecc60e5f6371bd714d6944a7911297495a0fada0801b2e395`). The original PIN unlocks the same exact amount, description and tags afterward.
- After stopping the rehearsal HTTP server, the updated app reopened from its service worker, unlocked, saved an expense, recalculated reports and downloaded a valid 38,939-byte PDF history.
- Production financial ledgers were not opened or edited. Browser QA used local disposable records. Physical Safari/Android devices were not tested.
- The existing GitHub workflow rebuilds, checks JavaScript, runs the full test suite and the unchanged PHP collector/access checks before deploying Pages.

## Rollback

Revert the dashboard release commit through a new commit on main and let the existing workflow deploy it. Do not clear browser storage. To move existing clients back immediately, also advance the service-worker cache identifier in that revert; the old worker otherwise may match previously downloaded cache bytes. No data migration needs reversing.
