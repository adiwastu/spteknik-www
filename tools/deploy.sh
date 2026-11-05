#!/usr/bin/env bash
# Safe deploy for the spteknik.com static site.
# Sidelines the wrangler OAuth (wasturaka account) so the API token
# from creds.env is used, deploys, then restores the OAuth file.
set -e
cd "$(dirname "$0")/.."

CF_OAUTH="$APPDATA/xdg.config/.wrangler/config/default.toml"
[ -f "$CF_OAUTH" ] && mv "$CF_OAUTH" "$CF_OAUTH.suspended"
trap '[ -f "$CF_OAUTH.suspended" ] && mv "$CF_OAUTH.suspended" "$CF_OAUTH"' EXIT

source creds.env
WRANGLER_SEND_METRICS=false npx wrangler deploy "$@"
