---
name: spteknik-deploy
description: Edit, deploy, verify, or roll back the spteknik.com static website (Cloudflare Workers). Use whenever the user mentions editing/updating/deploying the SPTeknik website, or mentions this repo (spteknik-www).
---

# spteknik.com — edit & deploy

spteknik.com is a **static website (plain HTML/CSS/JS in `public/`) served by a
Cloudflare Worker** named `spteknik` in account "Spteknik88@gmail.com's Account".
A tiny worker script (`src/index.ts`) 301s legacy WordPress paths to `/assets/*`.
**Every push to `main` = live in ~30 seconds** via GitHub Actions — no Cloudflare
credentials needed for normal work.

## The workflow

```bash
git pull                        # ALWAYS start current
# edit files in public/         # no build step
git commit -am "clear message"  # correct author — see Hard Rule 2
git push                        # CI deploys; watch the Actions tab / gh run watch
```

Verify after every deploy:

```bash
curl -s https://spteknik.com | grep -o "<title>[^<]*"   # SPTeknik – Simplify Your Prop-firm Funded Journey!
curl -s -o /dev/null -w '%{http_code}\n' https://spteknik.com/does-not-exist   # 404
```

Plus whatever you changed (curl-grep the section markup, or eyeball desktop+mobile).

## Rollback

- **Bad commit shipped:** `git revert <sha> && git push` — CI redeploys the revert.
- **Last-good local files:** redeploy them via the emergency path, then commit+push
  those exact bytes immediately.
- **EMERGENCY — revert whole domain to the old WordPress host** (only if the user
  explicitly asks): delete the worker routes —
  `source creds.env`, then DELETE
  `https://api.cloudflare.com/client/v4/zones/2c58de590d7b1d8a96258d01d232695b/workers/routes/{id}`
  for both routes. Traffic returns to Hostinger instantly (its DNS records remain).

## Maintenance mode

```bash
bash tools/maintenance.sh on    # spteknik.com -> branded 503 maintenance page (~30s)
bash tools/maintenance.sh off   # back to normal
```

Pages return HTTP 503 + Retry-After (SEO-safe); `/assets/*`, `/maintenance`,
`/robots.txt` keep loading. The flag lives in `src/flags.ts` — the script edits,
commits, and pushes it. Verify after toggling: `curl -s -o /dev/null -w '%{http_code}
' https://spteknik.com`
(503 when ON, 200 when OFF). Edit the page copy at `public/maintenance.html`.

## Hard rules (each one caused a real incident)

1. **NEVER run bare `npx wrangler deploy`.** A wrangler OAuth login on the machine
   silently overrides `CLOUDFLARE_API_TOKEN` and deploys to the WRONG account
   (happened 2026-11-04). Local deploys only via `tools/deploy.sh` (sidelines OAuth)
   and ONLY when CI is down — then commit+push the exact deployed bytes immediately.
2. **NEVER commit under the wrong author.** Before every commit session, verify
   `git config user.name` / `user.email` match the human you act for. Ask if
   unknown. (Happened: a commit session landed as "adiwastu" for work done by a
   different person.)
3. **NEVER edit DNS records** on the zone, never delete the `spteknik` worker,
   never touch other Cloudflare accounts. DNS = emergency rollback path.
4. **Never commit secrets** (`creds.env` is git-ignored; don't bypass).
5. Legacy `/wp-*` URLs must keep working — they 301 via `src/index.ts`. If you
   RENAME a file under `public/assets/`, add a redirect line in `src/index.ts`.

## Repo map

| Path | What |
|---|---|
| `public/index.html` | The homepage (whole site) |
| `public/assets/{img,css,icons,js/vendor}` | Images, main.css, favicons, jquery + scroll-top |
| `src/index.ts` | Worker: legacy 301 map + assets serving |
| `tools/deploy.sh` | Emergency local deploy (OAuth-safe) |
| `tools/sync-from-live.sh` | Disaster recovery: mirror live → public/ |
| `tools/set-slots.sh <n>` | Update Complete Plan slot counter + deploy (also: edit `slots-badge` in HTML manually) |
| `.github/workflows/deploy.yml` | CI deploy on push to main |

## Content gotchas

- Pricing cards: `<li>` in `.plan ul` are flex rows — wrap item text in ONE span
  or it renders as broken columns.
- Slot counter: `slots-badge` in `public/index.html`. Banner badge ("5 Pendaftar
  Pertama") is static copy — do not tie to the counter.
- Keep intact: WhatsApp number `6285174228240`, GTM + Facebook Pixel snippets,
  `spteknik.myr.id` checkout links, Telegram CTA (`t.me/spteknikbroadcast`).
- Sections: `#home`, `#masalah`, `#payout`, `#payment` (pricing), `#cerita`, `#faq`.
- WordPress was fully purged (2026-11-07): WP-style paths, meta, emoji scripts,
  generator tags are gone. Don't reintroduce WP patterns.
