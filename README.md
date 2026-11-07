# spteknik-www

Static source for **[spteknik.com](https://spteknik.com)** — plain HTML/CSS/JS
served by a Cloudflare Worker. No build step, no CMS. WordPress was fully
retired on 2026-11-07 (legacy `/wp-*` URLs still 301 via `src/index.ts`).

## Push = live

GitHub Actions deploys on every push to `main`
(`.github/workflows/deploy.yml`, `cloudflare/wrangler-action@v4`):

```bash
git pull                 # always start current
# edit files in public/
git commit -am "..." && git push   # live worldwide in ~30 seconds
```

## Onboarding (agents & humans)

👉 **[ONBOARDING.md](ONBOARDING.md)** — a checklist your AI agent can execute
end-to-end: prerequisites, clone, git identity (correct commit author), skill
install, verification, and the working rules. Point your agent at it.

## Emergency local deploy

Only when CI is down: requires `creds.env` (not committed) with
`CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`, then `bash tools/deploy.sh`
(sidelines any wrangler OAuth so it can't hijack the deploy to another account).
**Commit + push the exact deployed bytes immediately after** — the repo is the
source of truth.

| Tool | Purpose |
|---|---|
| `tools/deploy.sh` | Emergency local deploy |
| `tools/sync-from-live.sh` | Disaster recovery: mirror live site → `public/` |
| `tools/set-slots.sh <n>` | Complete Plan slot counter → deploy |
| `tools/crawl.mjs` | Mirror crawler (used by sync) |
| `tools/de-wp.py` | One-shot WP-purge transform (historical, already applied) |

## Rules

1. Never bare `npx wrangler deploy` (OAuth hijack risk) — push, or `tools/deploy.sh`.
2. Commit as the human you act for — never inherited identities.
3. Never touch DNS on the zone; it's the rollback path.
4. `creds.env` never gets committed.
