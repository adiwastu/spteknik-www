# WordPress → Cloudflare Workers migration checklist

## ⚠️ The one thing to understand first

WordPress is PHP + MySQL. **Cloudflare Workers don't run PHP.** So "host
WordPress on Workers" really means one of these:

| Option | What it is | What you keep / lose |
|---|---|---|
| **A. Static mirror** (recommended if site is mostly informational) | Crawl the live WP site → static HTML + assets → served by Workers Static Assets | Keep: the exact look/content/SEO. Lose: wp-admin, comments, PHP-based forms (I rebuild forms as Workers endpoints + Turnstile) |
| **B. Headless** (keep WP backend) | WP keeps running on the old host as a private CMS/API; Workers serves the frontend | Keep: editing content in wp-admin. Lose: fully killing the old hosting bill |
| **C. WP-in-Workers (php-wasm)** | WordPress compiled to WebAssembly on Workers | Experimental, slow, fragile — not for a real site |

For a typical company/brochure site, **A** is the right call: the site becomes a
handful of static files on Cloudflare, costs ~nothing, loads fast, and there is
no server to maintain or get hacked.

## What I need (in order)

1. **Cloudflare account** (`spteknik88@gmail.com`) — paste into `creds.env`:
   - `CLOUDFLARE_API_TOKEN` (permissions listed inside the file)
   - `CLOUDFLARE_ACCOUNT_ID`
   - `DOMAIN` — the domain that's already on Cloudflare
   - *Alternative:* instead of a token you can run `wrangler login` in a
     browser and log in as spteknik88@gmail.com. Token is more repeatable.

2. **The WordPress site:**
   - Public URL (`WP_URL`)
   - wp-admin login (`WP_ADMIN_USER` / `WP_ADMIN_PASS`) — needed for a clean
     content export and to inventory plugins (forms, galleries, etc.)

3. **Old hosting access** (`OLDHOST_*` or a backup zip dropped in this folder):
   - Needed if we want original-quality images / full wp-content instead of
     crawler-downloaded copies. A phpMyAdmin SQL dump is only needed for
     Option B or if there's a lot of structured content (e.g. product lists).

4. **Which parts of the site must stay dynamic:**
   - Contact forms? → rebuilt as Workers endpoints (Turnstile + email delivery)
   - Comments / user logins / webshop (WooCommerce)? → that pushes toward B,
     or rebuilding on something else
   - Newsletter signup? → usually swaps to the provider's embed (Mailchimp etc.)

## Cutover plan (once built)

1. Deploy site to Workers with a `workers.dev` preview URL → you verify it.
2. Attach the real domain (`DOMAIN`) to the Worker/Custom Domain.
3. Cloudflare DNS replaces the old A/CNAME record → traffic cuts over.
4. Old host stays up untouched for a week as rollback, then cancelled.

## Files in this folder

- `creds.env` — **paste your credentials here**, then `source creds.env`
- `.gitignore` — keeps creds.env out of any future git repo
- `MIGRATION-CHECKLIST.md` — this file
