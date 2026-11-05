# spteknik-www

Static source for **[spteknik.com](https://spteknik.com)** — plain HTML/CSS/JS served
by an assets-only Cloudflare Worker (name: `spteknik`). No build step, no CMS,
no server. Deploys go live worldwide in ~10 seconds, free hosting.

## Pipeline

```bash
bash tools/sync-from-live.sh   # optional: pull the current live site into public/
# edit files in public/        # what's here is what's live
bash tools/deploy.sh           # deploy to Cloudflare Workers
```

Requires **Node 18+** and a `creds.env` file at the project root (not committed)
containing `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

## Tools

| Script | What it does |
|---|---|
| `tools/deploy.sh` | Deploy. Sidelines any wrangler OAuth login first (it would otherwise hijack the deploy to the wrong account), uses the token from `creds.env`, restores OAuth after. |
| `tools/sync-from-live.sh` | Mirror the live site into `public/` (bootstrap / reset). |
| `tools/set-slots.sh <n>` | Update the Complete Plan launch-slot counter (card badge) and deploy. |
| `tools/crawl.mjs` | Static mirror crawler used by sync. |

## Notes

- `public/index.html` is the homepage. Sections: `#home`, `#masalah`, `#payout`,
  `#payment` (pricing), `#cerita`, `#faq`.
- WordPress-style asset paths (`/wp-content/...`) are preserved on purpose for
  SEO and old links.
- Complete Plan slot counter: the pill in the pricing card is updated manually as
  sales come in (`tools/set-slots.sh`). The top banner badge is static copy.
- The top promo banner and pricing card share the slot-count marketing copy —
  banner text says "5 Pendaftar Pertama" and stays fixed.
