#!/usr/bin/env bash
# Pull the current live spteknik.com into public/.
# The LIVE SITE is the content of record — run this to bootstrap or re-sync
# before editing. Then edit public/, then: bash tools/deploy.sh
set -e
cd "$(dirname "$0")/.."

node tools/crawl.mjs
rm -rf public
cp -r crawl-out/site public

# deploy requires a 404 page (wrangler.jsonc: not_found_handling=404-page);
# the crawler can't capture one, so write the boilerplate if missing
if [ ! -f public/404.html ]; then
cat > public/404.html <<'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>404 – SPTeknik</title>
<link rel="icon" href="/wp-content/uploads/2026/01/cropped-favicon-32x32-1-32x32.png" sizes="32x32">
<style>
  body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#0d1117;color:#e6edf3;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center}
  main{padding:2rem}
  img{max-width:180px;margin-bottom:1.5rem}
  h1{font-size:3rem;margin:0 0 .5rem}
  p{color:#8b949e;margin:0 0 1.5rem}
  a{color:#58a6ff;text-decoration:none;font-weight:600}
  a:hover{text-decoration:underline}
</style>
</head>
<body>
<main>
  <img src="/wp-content/themes/Raven/assets/logo-dark.png" alt="SPTeknik">
  <h1>404</h1>
  <p>Page not found.</p>
  <a href="/">Back to homepage</a>
</main>
</body>
</html>
EOF
fi

echo "public/ synced from live site. Edit it, then deploy: bash tools/deploy.sh"
