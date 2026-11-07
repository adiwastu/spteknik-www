# spteknik-www

Static source for **[spteknik.com](https://spteknik.com)** — plain HTML/CSS/JS served
by an assets-only Cloudflare Worker (name: `spteknik`). No build step, no CMS,
no server.

## Pipeline: push = live

**GitHub Actions deploys on every push to `main`** (`.github/workflows/deploy.yml`,
using `cloudflare/wrangler-action@v4`). The repo is the single source of truth:

```bash
git pull                 # always start current
# edit files in public/  # what's on main is what's live
git commit -m "..." && git push   # live worldwide in ~30 seconds
```

Rules that keep two people from fighting:

1. **Never deploy locally unless CI is broken.** If you deploy with
   `tools/deploy.sh` (emergency only), commit + push the exact files you deployed
   immediately after — an un-pushed local deploy is how work gets wiped.
2. **Pull before you edit.** Deployments are atomic per push; conflicts happen
   only in git, where they're visible and fixable.
3. Never edit DNS records on the zone; never delete the `spteknik` worker.
   DNS is the emergency rollback path to the old host.

## Local tooling (backup path)

Requires Node 18+ and a `creds.env` (not committed) with `CLOUDFLARE_API_TOKEN` +
`CLOUDFLARE_ACCOUNT_ID`. The token lives in GitHub repo secrets for CI; the same
token can be pasted locally for the emergency path.

| Script | What it does |
|---|---|
| `tools/deploy.sh` | Local deploy. Sidelines any wrangler OAuth login first (OAuth would otherwise hijack the deploy to the wrong account). **Emergency/CI-down path only** — normal flow is `git push`. |
| `tools/sync-from-live.sh` | Mirror the live site into `public/` (disaster recovery / fresh bootstrap). |
| `tools/set-slots.sh <n>` | Update the Complete Plan slot counter and deploy. |
| `tools/crawl.mjs` | Static mirror crawler used by sync. |

## Notes

- `public/index.html` is the homepage. Sections: `#home`, `#masalah`, `#payout`,
  `#payment` (pricing), `#cerita`, `#faq`.
- WordPress-style asset paths (`/wp-content/...`) are preserved on purpose for
  SEO and old links.
- Complete Plan slot counter: pill in the pricing card — edit `public/index.html`
  (search `slots-badge`), commit, push. The top banner badge is static copy.
