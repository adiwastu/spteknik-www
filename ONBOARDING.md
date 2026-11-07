# ONBOARDING — spteknik-www

You are an AI agent helping a human set up this repository on a new machine so
they can edit **spteknik.com** and ship changes. Follow every step in order.
When done, show your human the **Definition of Done** checklist at the bottom.

Site facts: static HTML/CSS/JS served by a Cloudflare Worker named `spteknik`.
**Every push to `main` = live on https://spteknik.com in ~30 seconds** (GitHub
Actions runs the deploy — no Cloudflare credentials needed for normal work).

---

## Step 1 — Prerequisites

Check and install what's missing:

- **Node.js 18+** (`node --version`) — https://nodejs.org if absent
- **git** (`git --version`)
- **gh CLI** (optional, convenient for PRs/Actions: `gh --version`)

Nothing else. There is no `npm install` — the only npm package used is
`wrangler`, fetched on demand via `npx`.

## Step 2 — Clone

```bash
git clone https://github.com/adiwastu/spteknik-www.git
cd spteknik-www
```

## Step 3 — Git identity (MANDATORY, do not skip)

The author of every commit must be the **human you are acting for** — never a
previous user of the machine, never a copied default, never yourself as "the
agent". Ask your human for their **real name and email** if you don't know them,
then:

```bash
git config user.name "Their Real Name"
git config user.email "their-email@example.com"
```

Before the first commit, verify:

```bash
git config user.name && git config user.email
```

Hard rule: if `git config user.name` returns someone other than the human you
act for, STOP and fix it before committing anything. Mis-attributed commits are
a real problem this repo has had before.

## Step 4 — Install the skill (agent only)

Copy `skills/spteknik-deploy/` into your agent's skills directory so deploy,
verify, and rollback choreography loads automatically, e.g. for ZCode-style
hosts:

```bash
cp -r skills/spteknik-deploy ~/.zcode/skills/spteknik-deploy
```

(Adjust the destination to your agent's skills folder convention. Then READ the
SKILL.md — it contains the hard rules, this repo's history, and content gotchas.)

## Step 5 — Credentials (only for local emergency deploys)

Normal work (edit → commit → push) needs **no credentials** — CI deploys using
secrets stored on GitHub. For the emergency local-deploy path you need a
`creds.env` at the repo root (never commit it) containing:

```
export CLOUDFLARE_API_TOKEN=...
export CLOUDFLARE_ACCOUNT_ID=...
```

Ask the site owner (Adi) for it. Skip this step if you won't do local deploys.

## Step 6 — Verify your setup (no deploy)

```bash
npx wrangler deploy --dry-run     # validates config + bundle, needs no token
curl -s https://spteknik.com | grep -o "<title>[^<]*"   # site is up
```

Optionally preview changes locally: `npx wrangler dev` → http://localhost:8787

## Step 7 — The workflow (this is the whole job)

```bash
git pull                        # ALWAYS start current
# edit files in public/         # plain HTML/CSS — no build step
git commit -am "clear message"  # correct author (Step 3)
git push                        # live in ~30s via CI
```

Watch your push go live: Actions tab on GitHub, or `gh run watch`.

---

## Hard rules (violations have caused real incidents)

1. **Never run bare `npx wrangler deploy`.** A wrangler OAuth login on the
   machine silently overrides API tokens and deploys to the WRONG account.
   Local deploys only via `tools/deploy.sh` (it sidelines OAuth safely) — and
   only when CI is down. Normal path is `git push`.
2. **Never commit as someone else.** Step 3 identity check before EVERY commit
   session.
3. **Never edit DNS records** on the spteknik.com zone, never delete the
   `spteknik` worker, never touch other Cloudflare accounts. DNS is the
   emergency rollback path.
4. **Never commit `creds.env`** or any secret. `.gitignore` covers it — don't
   override.
5. Don't re-add WordPress artifacts (the migration stripped them on purpose) or
   Hostinger telemetry scripts. Old `/wp-*` URLs 301-redirect via `src/index.ts`.

## Repo map

| Path | What |
|---|---|
| `public/` | **THE WEBSITE.** `index.html` is the homepage. |
| `public/assets/img` | Site images (ex-WP theme assets) |
| `public/assets/css/main.css` | The stylesheet (ex-`spteknik.css`) |
| `public/assets/icons/` | Favicons + tile |
| `public/assets/js/vendor/` | jQuery + scroll-top plugin |
| `src/index.ts` | Worker: legacy `/wp-*` 301 redirects + assets serving |
| `wrangler.jsonc` | Worker config (assets + main script) |
| `.github/workflows/deploy.yml` | CI: deploy on push to main |
| `tools/` | deploy.sh (emergency), sync-from-live.sh, set-slots.sh, crawl.mjs |
| `skills/spteknik-deploy/` | Agent skill (install per Step 4) |

## Content gotchas

- Pricing cards: `<li>` inside `.plan ul` are flex rows — wrap each item's text
  in ONE span or it renders as broken columns.
- Complete Plan slot counter: search `slots-badge` in `public/index.html`, edit
  the number, commit, push. Top banner badge ("5 Pendaftar Pertama") is static
  copy — do not tie it to the counter.
- Keep intact when editing: WhatsApp number (`6285174228240`), GTM + Facebook
  Pixel snippets, `spteknik.myr.id` checkout links, Telegram CTA.

---

## Definition of Done — report this to your human

- [ ] Node 18+ and git installed
- [ ] Repo cloned, on branch `main`
- [ ] `git config user.name` / `user.email` = the human acting (verified, not assumed)
- [ ] `skills/spteknik-deploy/` installed into the agent's skills dir
- [ ] `creds.env` present (only if emergency local deploys were requested)
- [ ] `npx wrangler deploy --dry-run` passes
- [ ] Live site confirmed up (title check)
- [ ] Hard rules read and understood (git identity, no bare wrangler deploy, DNS hands-off)
