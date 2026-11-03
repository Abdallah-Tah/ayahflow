# ayahflow.buildwithabdallah.com

Static pages for the App Store listing: home (`/`), privacy policy (`/privacy/`, the App Store "Privacy Policy URL")
and support (`/support/`, the "Support URL"). No scripts, trackers or external requests.

Before publishing, replace `SUPPORT_EMAIL` in `support/index.html` (two places) with the address you will read.
`privacy/index.html` is the same text as the app's `public/privacy.html`; change both together.

## Publish with GitHub Pages (free)

1. Create a public repository (for example `ayahflow-site`) and put the contents of this folder at its root.
2. Repository → Settings → Pages → Deploy from branch → `main` / root. `CNAME` already names the custom domain.
3. At your domain provider, add a DNS record: type `CNAME`, name `ayahflow`, value `<your-github-username>.github.io`.
4. When the domain check passes in Settings → Pages, tick "Enforce HTTPS".
