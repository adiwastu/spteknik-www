"""One-shot WordPress-purge transform for the spteknik.com overhaul.
Run from repo root AFTER git mv restructure: python tools/de-wp.py
Every replacement is asserted; any miss aborts without writing."""
import pathlib, re, sys

root = pathlib.Path(__file__).resolve().parent.parent
idx = root / "public" / "index.html"
nf = root / "public" / "404.html"
css = root / "public" / "assets" / "css" / "main.css"

s = idx.read_text(encoding="utf-8")
orig = s

def must(old, new, text, count=1):
    n = text.count(old)
    assert n == count, f"expected {count}x {old[:60]!r}, found {n}"
    return text.replace(old, new)

# ---------- html lang ----------
s = must('<html lang="en-US">', '<html lang="id">', s)

# ---------- head: dead WP meta/links (line-based, each guarded) ----------
def drop_line_containing(text, marker, expect=1):
    lines = [l for l in text.split("\n") if marker in l]
    assert len(lines) == expect, f"expected {expect} line(s) with {marker!r}, found {len(lines)}"
    out = text
    for l in lines:
        out = out.replace(l + "\n", "", 1)
    return out

s = drop_line_containing(s, 'oembed/1.0/embed', expect=2)
s = drop_line_containing(s, 'rel="https://api.w.org/"', expect=1)   # same line carries REST + EditURI links
s = drop_line_containing(s, 'content="WordPress 7.0.8"', expect=1)
s = drop_line_containing(s, "Site Kit by Google", expect=1)
s = drop_line_containing(s, "rel='shortlink'", expect=1)

# canonical: absolute
s = must('<link rel="canonical" href="/" />',
         '<link rel="canonical" href="https://spteknik.com/" />', s)

# ---------- favicon/asset paths ----------
s = must("/wp-content/uploads/2026/01/cropped-favicon-32x32-1-32x32.png", "/assets/icons/favicon-32.png", s)
s = must("/wp-content/uploads/2026/01/cropped-favicon-32x32-1-180x180.png", "/assets/icons/favicon-180.png", s)
s = must("/wp-content/uploads/2026/01/cropped-favicon-32x32-1-192x192.png", "/assets/icons/favicon-192.png", s)
s = must("/wp-content/uploads/2026/01/cropped-favicon-32x32-1-270x270.png", "/assets/icons/tile-270.png", s)

# ---------- drop the five WP inline style blocks ----------
def drop_block(text, block_id):
    m = re.search(r'[ \t]*<style id="%s">.*?</style>\r?\n?' % re.escape(block_id), text, re.S)
    assert m, f"style block {block_id} not found"
    return text[:m.start()] + text[m.end():]

for bid in ["wp-img-auto-sizes-contain-inline-css",
            "wp-emoji-styles-inline-css",
            "wp-block-library-inline-css",
            "classic-theme-styles-inline-css",
            "global-styles-inline-css"]:
    s = drop_block(s, bid)

# ---------- scripts: jquery path, drop migrate, vendorize wpfront ----------
s = must('"/wp-includes/js/jquery/jquery.min.js?ver=3.7.1"', '"/assets/js/vendor/jquery.min.js"', s)
s = re.sub(r'[ \t]*<script[^>]*jquery-migrate[^>]*></script>\r?\n?', "", s, count=1)
s = must('"/wp-content/plugins/wpfront-scroll-top/includes/assets/wpfront-scroll-top.min.js?ver=3.0.1.09211"',
         '"/assets/js/vendor/wpfront-scroll-top.min.js"', s)

# ---------- theme css path ----------
s = must("'/wp-content/themes/Raven/spteknik.css?ver=1788660308'", "'/assets/css/main.css'", s)

# ---------- body image refs ----------
# (story-om.jpg + story-propfirm-5days.jpg are unreferenced orphans after the
#  cerita reorder — kept in repo as brand assets, nothing to rewrite)
for f in ["logo-dark.png", "hero-payouts.png", "kelas.jpg", "up-arrow.png",
          "payout-1.jpg", "payout-2.jpg", "payout-3.jpg", "payout-4.jpg", "payout-5.jpg"]:
    old = f"/wp-content/themes/Raven/assets/{f}"
    n = s.count(old)
    if n == 0:
        print(f"  (skip: no html ref for {f})")
        continue
    s = s.replace(old, f"/assets/img/{f}")
    print(f"  rewrote {f} x{n}")

# ---------- wpfront inline data blob (URL is plain, brackets are \u003E escaped) ----------
s = must("https://spteknik.com/wp-content/uploads/2026/01/up-arrow.png",
         "https://spteknik.com/assets/img/up-arrow.png", s)

# ---------- body tag: drop WP plugin attrs/classes ----------
s = must('<body data-rsssl=1 id="home" class="home wp-singular page-template page-template-HomeSPTeknik page-template-HomeSPTeknik-php page page-id-491 wp-theme-Raven">',
         '<body id="home">', s)

# ---------- WP runtime scripts: speculation rules + emoji loader pair ----------
def drop_tag(text, pattern, label, expect=1):
    ms = re.findall(pattern, text, re.S)
    assert len(ms) == expect, f"expected {expect}x {label}, found {len(ms)}"
    return re.sub(pattern, "", text, count=expect, flags=re.S)

s = drop_tag(s, r'[ \t]*<script type="speculationrules">.*?</script>\r?\n?', "speculation rules block")
s = drop_tag(s, r'[ \t]*<script id="wp-emoji-settings" type="application/json">.*?</script>\r?\n?', "emoji settings block")
# emoji loader module — NOTE: the deployed file is MISSING its closing </script>
# (friend's pulse-btn edit ate it), so the block is matched up to its sourceURL
# comment instead of </script>. Removing it also repairs the unclosed-script
# breakage: the pulse-btn <style> after it was being swallowed as JS text.
s = drop_tag(s, r'[ \t]*<script type="module">\s*/\*! This file is auto-generated \*/\s*var e="script#wp-emoji-settings".*?//# sourceURL=https://spteknik\.com/wp-includes/js/wp-emoji-loader\.min\.js\r?\n?', "emoji loader module (unclosed)")

# LiteSpeed cache footer comment (leaks old infra)
s = re.sub(r'\n*<!-- Page cached by LiteSpeed Cache [0-9.]+ on [0-9: -]+ -->\s*$', '\n', s)

# ---------- any stragglers (context-printed) ----------
BAD = re.compile(r'wp-(content|includes|json|admin|emoji|singular|theme)[a-z-]*|data-rsssl|page-template|wp-theme')
left = [(m.group(0), s[max(0, m.start()-60):m.end()+60].replace("\n", " ")) for m in BAD.finditer(s)]
assert not left, "WP refs left in index.html:\n" + "\n".join(f"  {t}  …{c}…" for t, c in left[:10])

idx.write_text(s, encoding="utf-8")
print(f"index.html: OK ({len(orig)} -> {len(s)} chars)")

# ---------- 404 page ----------
n = nf.read_text(encoding="utf-8")
n = n.replace("/wp-content/uploads/2026/01/cropped-favicon-32x32-1-32x32.png", "/assets/icons/favicon-32.png")
n = n.replace("/wp-content/themes/Raven/assets/logo-dark.png", "/assets/img/logo-dark.png")
assert "wp-content" not in n
nf.write_text(n, encoding="utf-8")
print("404.html: OK")

# ---------- css: path refs + crawler-mangled data-URIs ----------
c = css.read_text(encoding="utf-8")
c = c.replace('url("/wp-content/themes/Raven/assets/payout-4.jpg")', 'url("/assets/img/payout-4.jpg")')
c = c.replace('url("/wp-content/themes/Raven/assets/payout-5.jpg")', 'url("/assets/img/payout-5.jpg")')
# crawler bug: '#n' inside SVG data-URIs got rewritten to a bogus path — restore the
# proper URL-encoded fragment reference so the turbulence filters apply again
broken = c.count("/wp-content/themes/Raven/%23n/")
assert broken == 2, f"expected 2 broken data-URI filter refs, found {broken}"
c = c.replace("filter='url(/wp-content/themes/Raven/%23n/)'", "filter='url(%23n)'")
assert "/wp-content" not in c, "wp-content still in css"
css.write_text(c, encoding="utf-8")
print("main.css: OK (paths + 2 data-URI filter refs repaired)")

# ---------- robots + sitemap ----------
(root / "public" / "robots.txt").write_text(
    "User-agent: *\nAllow: /\n\nSitemap: https://spteknik.com/sitemap.xml\n", encoding="utf-8")
(root / "public" / "sitemap.xml").write_text(
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    "  <url><loc>https://spteknik.com/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n"
    "</urlset>\n", encoding="utf-8")
print("robots.txt + sitemap.xml: OK")
