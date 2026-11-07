#!/usr/bin/env bash
# Toggle site maintenance mode and deploy via CI (git push).
# Usage:  bash tools/maintenance.sh on|off
# ON  -> spteknik.com serves the maintenance page (HTTP 503) for all pages;
#        /assets/*, /maintenance.html, /robots.txt keep loading.
# OFF -> normal site.
set -e
cd "$(dirname "$0")/.."

MODE="${1:-}"
case "$MODE" in
  on)  NEW="true" ;;
  off) NEW="false" ;;
  *)   echo "usage: bash tools/maintenance.sh on|off"; exit 1 ;;
esac

FLAGS="src/flags.ts"
[ -f "$FLAGS" ] || { echo "src/flags.ts missing"; exit 1; }

CURRENT=$(python3 -c "
import pathlib, re
s = pathlib.Path('src/flags.ts').read_text(encoding='utf-8')
m = re.search(r'MAINTENANCE_MODE = (true|false)', s)
print(m.group(1) if m else 'ERR')
")
[ "$CURRENT" = "true" ] || [ "$CURRENT" = "false" ] || { echo "could not read current flag"; exit 1; }

if [ "$CURRENT" = "$NEW" ]; then
  echo "maintenance mode is already $MODE — nothing to do"
  exit 0
fi

python3 - "$NEW" <<'EOF'
import pathlib, re, sys
p = pathlib.Path('src/flags.ts')
s = p.read_text(encoding='utf-8')
new = sys.argv[1]
s2, n = re.subn(r'(MAINTENANCE_MODE = )(true|false)', rf'\g<1>{new}', s)
assert n == 1, f'flag pattern matched {n} times'
p.write_text(s2, encoding='utf-8')
print(f'flag flipped to {new}')
EOF

git add "$FLAGS"
git commit -q -m "chore: maintenance mode ${MODE}"
git push
echo "pushed — CI is deploying. Maintenance ${MODE} goes live in ~30s."
echo "watch: gh run watch \$(gh run list --limit 1 --json databaseId -q '.[0].databaseId')"
