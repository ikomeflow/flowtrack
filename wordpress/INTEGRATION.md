# FlowTrack on ikomeflow.com

Completed on 16 October 2026.

## Public addresses

- Portfolio page: https://ikomeflow.com/flowtrack/
- Application: https://flowtrack.ikomeflow.com/
- Source repository: https://github.com/ikomeflow/flowtrack
- Successful deployment run: https://github.com/ikomeflow/flowtrack/actions/runs/38889804877

The WordPress page uses the homepage's navy-and-blue design, a brief introduction, an app preview labeled as sample data, and a direct launch link. Source-code buttons have been removed from the user-facing page. Privacy and backup information is in an expandable disclosure, including the requirement to save a recovery key before forgetting a PIN. FlowTrack is also in the homepage navigation and appears first in its Selected work carousel; the eight existing projects are retained. The app runs independently on GitHub Pages. WordPress does not store visitors' financial records.

## Hosting configuration

The domain is registered with Hostinger, while **Cloudflare is authoritative for DNS**. Add or edit subdomain records in Cloudflare, not Hostinger's nameserver controls.

| Setting | Configured value |
| --- | --- |
| GitHub repository | `ikomeflow/flowtrack` (public) |
| Deployment branch | `main` |
| Pages source | GitHub Actions |
| Published files | `dist/` |
| Pages custom domain | `flowtrack.ikomeflow.com` |
| Enforce HTTPS | Enabled |
| DNS type | CNAME |
| DNS name | `flowtrack` |
| DNS target | `ikomeflow.github.io` |
| Cloudflare proxy | DNS only |
| TTL | Auto |

The existing apex, www, FTP and verification records were retained. No nameserver changes were made.

## WordPress editing

Edit the **FlowTrack** page under Pages. Its page ID is 337. The page uses a Custom HTML block with styling copied from the homepage; it needs no new plugin. `flowtrack-page.html` is a portable copy of the markup. The homepage is page ID 5; `homepage-flowtrack-card.html` contains the new carousel card. Its carousel has nine slides and nine controls after this update.

The current screenshot is attachment 347, with alt text and a demo caption. It shows the minimal version 1.4 Home screen with sample data and is stored at https://ikomeflow.com/wp-content/uploads/2026/10/flowtrack-minimal-desktop.png. The earlier attachment 339 is retained.

Keep the launch button pointing to the canonical HTTPS app address. Use JSON backup/restore when moving a ledger between addresses or browser profiles. The portfolio page's privacy text describes the FlowTrack app; the surrounding WordPress website may have its own hosting, analytics or plugins.

## Updating the app

1. Commit source changes to the repository's `main` branch.
2. For changes to app-shell files, increment the cache version in `dist/sw.js`.
3. The workflow checks JavaScript syntax, runs the unit tests, and publishes `dist/`.
4. Confirm the workflow succeeds and open the app over HTTPS.

No GitHub credential, WordPress password, financial records or Cloudflare secret is included in the source package.

## Verification

- GitHub's deployment job succeeded, including syntax checks and all 9 unit tests.
- GitHub reported the custom-domain DNS check successful; HTTPS enforcement was enabled after certificate issuance.
- The public WordPress page rendered with the screenshot, demo caption, feature sections, privacy information and source link.
- Clicking **Launch FlowTrack** on the published page opened the app at its HTTPS subdomain.
- The deployed demo dashboard calculated XAF 609,700.00 net; leaving demo mode restored the empty personal ledger.
- The deployed app's Settings confirmed that offline app files were ready on this device.
- Earlier local testing passed 43 browser assertions at both the root and a GitHub Pages-style subpath, including mobile layouts, CRUD, backup/restore and offline reloads.

