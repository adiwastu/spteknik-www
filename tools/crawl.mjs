// Static-mirror crawler for spteknik.com -> crawl-out/site/
// Deps: none (Node >= 18). Run:  node tools/crawl.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'https://spteknik.com';
const HOST = 'spteknik.com';
const ROOT = fileURLToPath(new URL('../crawl-out/site/', import.meta.url));
const CONCURRENCY = 4;
const UA = 'Mozilla/5.0 (compatible; SiteMigrationBot/1.0; static-mirror for spteknik.com)';

fs.mkdirSync(ROOT, { recursive: true });

const pages = new Map();        // canonical url -> info
const assets = new Map();       // canonical url -> info
const alias = new Map();        // requested url -> final url (redirects)
const rawHtml = new Map();
const rawCss = new Map();
const failed = [];
const externalHosts = new Map();
const bigAssets = [];
const queue = [];
const seen = new Set();
let busy = 0;

const SKIP = /\/wp-admin|\/wp-login\.php|\/xmlrpc\.php|\/feed\/?$|\/wp-json|\/comment-page-|\?replytocom|#|\/sitemap|\.xsl(\?|$)|\.(zip|exe|msi|tar|gz)(\?|$)/i;
const ASSET_EXT = /\.(png|jpe?g|gif|webp|avif|svg|ico|css|js|mjs|woff2?|ttf|eot|otf|mp4|webm|mp3|pdf|txt|csv|map)$/i;

function norm(u, base) {
  try {
    const url = new URL(u, base);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.hostname !== HOST) return { external: url.toString() };
    url.protocol = 'https:'; url.hostname = HOST; url.hash = '';
    let s = url.toString();
    if (!s.endsWith('/') && !path.posix.basename(url.pathname).includes('.')) s += '/';
    return { internal: s };
  } catch { return null; }
}

function outPathFor(urlStr, isPage) {
  const u = new URL(urlStr);
  let p = decodeURIComponent(u.pathname);
  if (p.endsWith('/')) p += 'index.html';
  else if (isPage && !ASSET_EXT.test(p)) p += '/index.html';
  return path.join(ROOT, p.replace(/^\/+/, ''));
}

async function fetchOnce(url) {
  return fetch(url, { redirect: 'follow', headers: { 'User-Agent': UA, Accept: '*/*' }, signal: AbortSignal.timeout(45000) });
}

function extractRefsFromHtml(html) {
  const refs = new Set();
  const patterns = [
    /<a\b[^>]+href\s*=\s*["']([^"'#][^"']*)["']/gi,
    /<link\b[^>]+href\s*=\s*["']([^"']+)["'][^>]*>/gi,
    /<(?:img|script|source|video|audio|embed|input)\b[^>]+(?:src|poster)\s*=\s*["']([^"']+)["']/gi,
    /srcset\s*=\s*["']([^"']+)["']/gi,
  ];
  for (const r of patterns) {
    let m;
    while ((m = r.exec(html))) {
      if (r.source.includes('srcset')) m[1].split(',').forEach(p => refs.add(p.trim().split(/\s+/)[0]));
      else refs.add(m[1]);
    }
  }
  let m;
  const ur = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
  while ((m = ur.exec(html))) refs.add(m[1]);

  const forms = [];
  const fre = /<form\b[^>]*>/gi;
  while ((m = fre.exec(html))) {
    const tag = m[0];
    forms.push({
      action: (tag.match(/action\s*=\s*["']([^"']*)["']/i) || [])[1] || '',
      method: (tag.match(/method\s*=\s*["']([^"']*)["']/i) || [])[1] || 'get',
    });
  }
  const title = (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || '';
  return { refs: [...refs], forms, title };
}

// rewrite refs to root-relative paths ("/wp-content/..."), safe at any page depth
function rewriteHtml(html, pageUrl) {
  const mapRef = (ref) => {
    if (ref.startsWith('#')) return ref; // in-page anchors must never be rewritten
    const n = norm(ref, pageUrl);
    if (!n || n.external) return ref;
    const target = alias.get(n.internal) || n.internal;
    const known = pages.has(target) || assets.has(target);
    const u = new URL(target);
    let out = u.pathname + (u.search || '');
    if (out === '' || out === '/') out = '/';
    if (known || ASSET_EXT.test(u.pathname)) return out;
    return ref; // unknown internal ref: leave untouched
  };
  let out = html.replace(/((?:href|src|poster)\s*=\s*)(["'])([^"']+)\2/gi,
    (all, pre, q, val) => pre + q + mapRef(val) + q);
  out = out.replace(/(srcset\s*=\s*)(["'])([^"']+)\2/gi, (all, pre, q, val) =>
    pre + q + val.split(',').map(p => { const t = p.trim().split(/\s+/); t[0] = mapRef(t[0]); return t.join(' '); }).join(', ') + q);
  out = out.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (all, q, val) => `url(${q}${mapRef(val)}${q})`);
  return out;
}

function rewriteCss(css, cssUrl) {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (all, q, val) => {
    const n = norm(val, cssUrl);
    if (!n || n.external) return all;
    const target = alias.get(n.internal) || n.internal;
    const u = new URL(target);
    return `url(${q}${u.pathname}${u.search || ''}${q})`;
  });
}

async function handle(urlStr, kind) {
  if (seen.has(urlStr) || SKIP.test(urlStr)) { seen.add(urlStr); return; }
  seen.add(urlStr);
  let res;
  try { res = await fetchOnce(urlStr); }
  catch (e) { failed.push({ url: urlStr, err: String(e).slice(0, 140) }); console.error('FETCH FAIL', urlStr, String(e).slice(0, 100)); return; }
  const finalUrl = res.url && res.url !== urlStr ? res.url : urlStr;
  if (finalUrl !== urlStr && !alias.has(urlStr)) alias.set(urlStr, finalUrl);
  if (seen.has(finalUrl) && finalUrl !== urlStr) { /* already handled */ }
  if (!res.ok) { failed.push({ url: urlStr, err: `HTTP ${res.status}` }); console.error('HTTP', res.status, urlStr); return; }
  if (seen.has(finalUrl) && finalUrl !== urlStr && (pages.has(finalUrl) || assets.has(finalUrl))) return;

  const ct = res.headers.get('content-type') || '';
  try {
    if (kind !== 'asset' && (ct.includes('text/html') || ct.includes('application/xhtml'))) {
      const buf = Buffer.from(await res.arrayBuffer());
      const file = outPathFor(finalUrl, true);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const html = buf.toString('utf8');
      fs.writeFileSync(file, rewriteHtml(html, finalUrl));
      const { refs, forms, title } = extractRefsFromHtml(html);
      for (const r of refs) {
        const n = norm(r, finalUrl);
        if (!n) continue;
        if (n.external) { const h = new URL(n.external).hostname; externalHosts.set(h, (externalHosts.get(h) || 0) + 1); continue; }
        if (SKIP.test(n.internal)) continue;
        const isAsset = ASSET_EXT.test(new URL(n.internal).pathname);
        queue.push({ url: n.internal, kind: isAsset ? 'asset' : 'page' });
      }
      pages.set(finalUrl, { file: path.relative(path.dirname(ROOT), file), title, forms, bytes: buf.length });
      rawHtml.set(finalUrl, html);
    } else {
      const buf = Buffer.from(await res.arrayBuffer());
      const file = outPathFor(finalUrl, false);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, buf);
      assets.set(finalUrl, { file: path.relative(path.dirname(ROOT), file), bytes: buf.length, ct });
      if (ct.includes('text/css')) {
        const css = buf.toString('utf8');
        fs.writeFileSync(file, rewriteCss(css, finalUrl));
        for (const m of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)) {
          const n = norm(m[1], finalUrl);
          if (n && !n.external && !SKIP.test(n.internal)) queue.push({ url: n.internal, kind: 'asset' });
        }
        rawCss.set(finalUrl, css);
      }
      if (buf.length > 5_000_000) bigAssets.push({ url: finalUrl, mb: +(buf.length / 1e6).toFixed(1) });
    }
  } catch (e) {
    failed.push({ url: urlStr, err: 'WRITE: ' + String(e).slice(0, 120) });
    console.error('SAVE FAIL', urlStr, String(e).slice(0, 100));
  }
}

async function worker() {
  while (true) {
    const job = queue.shift();
    if (!job) {
      if (queue.length === 0 && busy === 0) return;
      await new Promise(r => setTimeout(r, 100));
      continue;
    }
    busy++;
    try { await handle(job.url, job.kind); }
    catch (e) { failed.push({ url: job.url, err: String(e).slice(0, 140) }); console.error('ERR', job.url, String(e).slice(0, 100)); }
    busy--;
  }
}

async function seed() {
  queue.push({ url: ORIGIN + '/', kind: 'page' });
  for (const ep of ['pages', 'posts']) {
    try {
      const res = await fetchOnce(`${ORIGIN}/wp-json/wp/v2/${ep}?per_page=100&_fields=link`);
      if (!res.ok) { console.error('wp-json', ep, res.status); continue; }
      const list = await res.json();
      for (const item of list) {
        const n = norm(item.link, ORIGIN);
        if (n && n.internal && !SKIP.test(n.internal)) queue.push({ url: n.internal, kind: 'page' });
      }
      console.log(`wp-json ${ep}: ${list.length}`);
    } catch (e) { console.error('wp-json seed failed:', String(e).slice(0, 100)); }
  }
  for (const sm of ['sitemap.xml', 'sitemap_index.xml', 'wp-sitemap.xml']) {
    try {
      const res = await fetchOnce(`${ORIGIN}/${sm}`);
      if (!res.ok) continue;
      const xml = await res.text();
      const locs = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map(m => m[1]);
      for (const loc of locs) {
        if (/\.xsl/i.test(loc)) continue;
        if (/sitemap[^/]*\.xml$/i.test(loc)) {
          try {
            const r2 = await fetchOnce(loc);
            const x2 = await r2.text();
            let n2 = 0;
            for (const m2 of x2.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)) {
              const n = norm(m2[1], ORIGIN);
              if (n && n.internal && !SKIP.test(n.internal)) { queue.push({ url: n.internal, kind: 'page' }); n2++; }
            }
            console.log(`sitemap ${loc}: +${n2}`);
          } catch {}
          continue;
        }
        const n = norm(loc, ORIGIN);
        if (n && n.internal && !SKIP.test(n.internal)) queue.push({ url: n.internal, kind: 'page' });
      }
    } catch {}
  }
  console.log('queue size after seed:', queue.length);
}

console.log('seeding: homepage + wp-json + sitemaps...');
await seed();
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

// re-apply final rewrite pass now that alias/redirect info is complete
for (const [url, info] of pages) {
  fs.writeFileSync(path.join(path.dirname(ROOT), info.file), rewriteHtml(rawHtml.get(url), url));
}
for (const [url, css] of rawCss) {
  const info = assets.get(url);
  if (info) fs.writeFileSync(path.join(path.dirname(ROOT), info.file), rewriteCss(css, url));
}
// rescue plugin-injected assets that static markup never references
// (e.g. the wpfront scroll-top arrow image, injected via JS settings)
try {
  const homeHtml = rawHtml.get(alias.get(ORIGIN + '/') || ORIGIN + '/') || [...rawHtml.values()][0];
  const idx = homeHtml ? homeHtml.indexOf('up-arrow.png') : -1;
  if (idx > -1) {
    const frag = homeHtml.slice(Math.max(0, idx - 300), idx + 30).replace(/\\/g, '');
    const m = frag.match(/https:\/\/spteknik\.com\/[^\s"']*up-arrow\.png/);
    if (m) {
      const res = await fetchOnce(m[0]);
      if (res.ok) {
        const f = outPathFor(m[0], false);
        fs.mkdirSync(path.dirname(f), { recursive: true });
        const buf = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(f, buf);
        assets.set(m[0], { file: path.relative(path.dirname(ROOT), f), bytes: buf.length, ct: 'image/png' });
        console.log('rescued plugin asset:', m[0], `(${(buf.length / 1024).toFixed(0)}KB)`);
      }
    }
  }
} catch (e) { console.error('asset rescue failed:', String(e).slice(0, 100)); }

try {
  const r = await fetchOnce(ORIGIN + '/robots.txt');
  if (r.ok) { const f = outPathFor(ORIGIN + '/robots.txt', false); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, await r.text()); }
} catch {}

const report = {
  origin: ORIGIN,
  crawledAt: new Date().toISOString(),
  pages: pages.size,
  assets: assets.size,
  failed: failed.length,
  totalAssetMB: +([...assets.values()].reduce((s, a) => s + a.bytes, 0) / 1e6).toFixed(1),
  bigAssets: bigAssets.sort((a, b) => b.mb - a.mb).slice(0, 10),
  externalHosts: Object.fromEntries([...externalHosts.entries()].sort((a, b) => b[1] - a[1])),
  pagesWithForms: [...pages.entries()].filter(([, p]) => p.forms.length).map(([u, p]) => ({ url: u, forms: p.forms })),
  failedList: failed.slice(0, 30),
  pageList: [...pages.keys()].sort(),
};
fs.writeFileSync(path.join(path.dirname(ROOT), '..', 'report.json'), JSON.stringify(report, null, 2));
console.log('DONE', JSON.stringify({ pages: report.pages, assets: report.assets, failed: report.failed, totalAssetMB: report.totalAssetMB, formsOnPages: report.pagesWithForms.length }));
