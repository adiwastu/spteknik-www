"""Replace the #payment price-grid with the new 5-tier pricing table (Nov 2025 price list).
Run from project root: python tools/add-pricing.py"""
import pathlib, re, sys

root = pathlib.Path(__file__).resolve().parent.parent
html_path = root / "public" / "index.html"
css_path = root / "public" / "wp-content" / "themes" / "Raven" / "spteknik.css"

html = html_path.read_text(encoding="utf-8")

start = html.find('<div class="price-grid">')
if start == -1:
    sys.exit("price-grid not found")
# walk forward tracking div depth to find matching close
depth, i = 0, start
while True:
    m = re.compile(r'<div\b|</div>').search(html, i)
    if not m:
        sys.exit("unbalanced divs — aborting")
    depth += 1 if m.group(0) == "<div" else -1
    i = m.end()
    if depth == 0:
        end = i
        break

WA = "https://api.whatsapp.com/send?phone=6285174228240"

new_grid = '''<div class="price-grid">

      <div class="plan">
        <h3>Free Starter</h3>
        <p class="for">Lead magnet &mdash; kenalan dulu, gratis</p>
        <p class="price">Rp 0</p>
        <ul>
          <li class="key">Video case-study gratis: dari losing trade ke 50 payouts</li>
          <li class="key">Checklist prop firm</li>
        </ul>
        <a class="btn btn-primary" href="%(WA)s&text=Halo+SPTeknik%%2C+saya+mau+klaim+Free+Starter+(video+case+study+%%2B+checklist+prop+firm)." target="_blank" rel="noopener">Klaim Gratis</a>
      </div>

      <div class="plan">
        <h3>Foundation</h3>
        <p class="for">Entry plan untuk pemula</p>
        <p class="price">Rp 267.000</p>
        <ul>
          <li class="key">Telegroup chat</li>
          <li class="key">"SP Teknik" ebook</li>
          <li class="key">"Apa Itu Valas?" ebook</li>
        </ul>
        <a class="btn btn-primary" href="https://spteknik.myr.id/catalog/spteknik-foundation/" target="_blank" rel="noopener">Beli Sekarang</a>
      </div>

      <div class="plan">
        <h3>Blueprint to Funded</h3>
        <p class="for">Course only</p>
        <p class="price">Rp 596.000</p>
        <ul>
          <li class="key">16-part e-course SP Teknik</li>
          <li class="key">Kedua ebook ("SP Teknik" + "Apa Itu Valas?")</li>
          <li class="key"><span class="hl">Lifetime</span> update course</li>
        </ul>
        <a class="btn btn-primary" href="https://spteknik.myr.id/course/spteknik-e-course-blueprint-to-funded/" target="_blank" rel="noopener">Beli Sekarang</a>
      </div>

      <div class="plan">
        <h3>Growth</h3>
        <p class="for">Live support dan mentoring</p>
        <p class="price">Rp 1.500.000</p>
        <ul>
          <li class="key">12 live meetings</li>
          <li class="key">Priority chat</li>
          <li class="key">Rekap "Trading &amp; Mindset Behind the Trade"</li>
          <li class="key">Feedback analisa market</li>
          <li class="key">Lifetime akses kelas mingguan</li>
          <li class="key">Lifetime akses forecast</li>
          <li class="key">Telegroup chat</li>
          <li class="key">Kedua ebook</li>
        </ul>
        <a class="btn btn-primary" href="https://spteknik.myr.id/catalog/spteknik-growth/" target="_blank" rel="noopener">Beli Sekarang</a>
      </div>

      <div class="plan plan-hot plan-mastery">
        <span class="plan-badge">Rekomendasi</span>
        <h3>Mastery (Blueprint + Growth)</h3>
        <p class="for">Best value &mdash; semua dari Blueprint + Growth</p>
        <p class="price">Rp 1.799.000</p>
        <p class="launch-note"><span class="hl">Rp 1.599.000</span> untuk 5 pembeli pertama</p>
        <ul>
          <li class="key">Semua materi Blueprint to Funded &mdash; 16-part e-course + kedua ebook</li>
          <li class="key">Semua fasilitas Growth &mdash; 12 live meetings, priority chat, rekap trading &amp; mindset, feedback market, kelas mingguan, forecast, telegroup</li>
          <li>Hemat <span class="hl">Rp 297k</span> vs beli terpisah (Rp 2.096.000) &mdash; hemat <span class="hl">Rp 497k</span> selama periode launch</li>
        </ul>
        <a class="btn btn-accent" href="%(WA)s&text=Halo+SPTeknik%%2C+saya+mau+ambil+paket+Mastery+(Blueprint+%%2B+Growth)." target="_blank" rel="noopener">Ambil Mastery</a>
      </div>

    </div>''' % {"WA": WA}

html = html[:start] + new_grid + html[end:]
html_path.write_text(html, encoding="utf-8")
print(f"index.html: replaced {end - start} chars of grid with new 5-tier pricing")

css = css_path.read_text(encoding="utf-8")
if ".plan-mastery" not in css:
    css += """
/* Mastery feature card: centered double-width slot under the 4-col price grid */
.plan-mastery{grid-column:2 / span 2}
.plan-mastery .launch-note{margin:6px 0 0;font-size:.85rem;color:var(--muted)}
.plan-mastery ul{margin-top:16px}
@media(max-width:960px){.plan-mastery{grid-column:1 / -1}}
"""
    css_path.write_text(css, encoding="utf-8")
    print("spteknik.css: appended .plan-mastery feature-card styles")
else:
    print("spteknik.css: styles already present")
