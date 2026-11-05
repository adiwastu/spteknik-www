#!/usr/bin/env bash
# Update the Complete Plan launch-slot counter (pricing card badge) on the
# website and deploy. Run after every Complete Plan sale.
# (The top banner badge is static at 5 — it is NOT managed by this script.)
# Usage:  bash tools/set-slots.sh 3      (number of slots still available)
set -e
cd "$(dirname "$0")/.."

[ -f public/index.html ] || { echo "public/ missing — run tools/sync-from-live.sh first"; exit 1; }
N="$1"
[ -n "$N" ] || { echo "usage: bash tools/set-slots.sh <slots-remaining>"; exit 1; }
case "$N" in *[!0-9]*|'') echo "usage: bash tools/set-slots.sh <slots-remaining>"; exit 1;; esac

python3 - "$N" <<'EOF'
import pathlib, re, sys
p = pathlib.Path('public/index.html')
s = p.read_text(encoding='utf-8')
n = sys.argv[1]
s, c1 = re.subn(r'(<span class="slots-badge"[^>]*>)[^<]*(</span>)', rf'\g<1>{n} slot tersisa\g<2>', s)
if c1 != 1:
    print(f'ERROR: pricing card badge matches: {c1} (expected 1) — update manually')
    sys.exit(1)
p.write_text(s, encoding='utf-8')
print(f'slot counter set to {n}')
EOF

bash tools/deploy.sh
