// spteknik.com worker: serves static assets and 301s legacy WordPress paths to
// their post-migration locations so old links keep working.
// The site itself lives in public/ — edit there, deploy via git push (CI).
//
// Maintenance mode: flip the flag in src/flags.ts (or `bash tools/maintenance.sh on|off`).
// When ON, every page request gets the maintenance page with HTTP 503 (SEO-safe);
// static assets under /assets/ still load so the maintenance page renders.

import { MAINTENANCE_MODE } from "./flags";

interface Env {
  ASSETS: { fetch: (request: Request) => Response };
  // worker secret (wrangler secret put ANALYTICS_TOKEN): a Cloudflare API token
  // with Zone Analytics read, used by the analytics dashboard to query GraphQL.
  ANALYTICS_TOKEN?: string;
}

// explicit old → new map (files that existed under WordPress paths)
const REDIRECTS: Record<string, string> = {
  // theme css
  "/wp-content/themes/Raven/spteknik.css": "/assets/css/main.css",
  // theme images
  "/wp-content/themes/Raven/assets/logo-dark.png": "/assets/img/logo-dark.png",
  "/wp-content/themes/Raven/assets/hero-payouts.png": "/assets/img/hero-payouts.png",
  "/wp-content/themes/Raven/assets/kelas.jpg": "/assets/img/kelas.jpg",
  "/wp-content/themes/Raven/assets/payout-1.jpg": "/assets/img/payout-1.jpg",
  "/wp-content/themes/Raven/assets/payout-2.jpg": "/assets/img/payout-2.jpg",
  "/wp-content/themes/Raven/assets/payout-3.jpg": "/assets/img/payout-3.jpg",
  "/wp-content/themes/Raven/assets/payout-4.jpg": "/assets/img/payout-4.jpg",
  "/wp-content/themes/Raven/assets/payout-5.jpg": "/assets/img/payout-5.jpg",
  "/wp-content/themes/Raven/assets/story-om.jpg": "/assets/img/story-om.jpg",
  "/wp-content/themes/Raven/assets/story-propfirm-5days.jpg": "/assets/img/story-propfirm-5days.jpg",
  // uploads
  "/wp-content/uploads/2026/01/up-arrow.png": "/assets/img/up-arrow.png",
  "/wp-content/uploads/2026/01/cropped-favicon-32x32-1-32x32.png": "/assets/icons/favicon-32.png",
  "/wp-content/uploads/2026/01/cropped-favicon-32x32-1-180x180.png": "/assets/icons/favicon-180.png",
  "/wp-content/uploads/2026/01/cropped-favicon-32x32-1-192x192.png": "/assets/icons/favicon-192.png",
  "/wp-content/uploads/2026/01/cropped-favicon-32x32-1-270x270.png": "/assets/icons/tile-270.png",
  // plugin + core scripts
  "/wp-content/plugins/wpfront-scroll-top/includes/assets/wpfront-scroll-top.min.js": "/assets/js/vendor/wpfront-scroll-top.min.js",
  "/wp-includes/js/jquery/jquery.min.js": "/assets/js/vendor/jquery.min.js",
};

// dead WordPress endpoints → homepage
const DEAD_PREFIXES = ["/wp-admin", "/wp-json", "/wp-login.php", "/wp-cron.php", "/xmlrpc.php", "/wp-sitemap", "/feed"];

// paths that keep working even while the site is in maintenance mode
const MAINTENANCE_ALLOWED = ["/assets/", "/maintenance", "/favicon.ico", "/robots.txt"];

function redirect(to: string, request: Request): Response {
  return new Response(null, {
    status: 301,
    headers: { location: new URL(to, request.url).toString() },
  });
}

// ---------------- analytics.spteknik.com (private traffic dashboard) ----------------
// Served by this worker via the zone route on that hostname. Every response is
// marked noindex + the host serves a disallow-all robots.txt, so search engines
// stay away. Traffic numbers come from the Cloudflare GraphQL API using the
// ANALYTICS_TOKEN worker secret (never stored in the repo).
const ANALYTICS_HOST = "analytics.spteknik.com";
const ZONE_ID = "2c58de590d7b1d8a96258d01d232695b";

const NOINDEX_HEADERS: Record<string, string> = {
  "x-robots-tag": "noindex, nofollow",
  "cache-control": "no-store",
};

const ANALYTICS_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>SPTeknik · Analytics (private)</title>
<style>
  :root{--bg:#0E1216;--card:#161C22;--line:#2A323C;--gold:#D9AE3A;--txt:#E8EDF2;--mut:#A9B2BE}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--txt);font-family:'Host Grotesk',-apple-system,'Segoe UI',Roboto,sans-serif;padding:40px 20px}
  .wrap{max-width:860px;margin:0 auto}
  .top{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
  h1{font-size:1.4rem;letter-spacing:-.02em;margin:0}
  .tag{font-family:ui-monospace,monospace;font-size:.62rem;text-transform:uppercase;letter-spacing:.12em;color:var(--mut);border:1px solid var(--line);border-radius:999px;padding:5px 11px;white-space:nowrap}
  .notice{display:none;border:1px dashed var(--gold);border-radius:12px;padding:14px;color:var(--mut);font-size:.85rem;margin:20px 0 0;line-height:1.5}
  .cards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:26px 0}
  .card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px}
  .card .k{font-family:ui-monospace,monospace;font-size:.62rem;letter-spacing:.12em;text-transform:uppercase;color:var(--mut)}
  .card .v{font-size:1.9rem;font-weight:700;letter-spacing:-.02em;margin-top:6px}
  .card .s{font-size:.78rem;color:var(--mut);margin-top:2px}
  .panel{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px;margin-bottom:14px}
  .panel h2{font-size:.82rem;margin:0 0 14px;color:var(--gold);font-family:ui-monospace,monospace;text-transform:uppercase;letter-spacing:.1em}
  .chart{display:flex;align-items:flex-end;gap:2px;height:150px}
  .chart .b{flex:1;background:#2A323C;min-width:2px;border-radius:2px 2px 0 0}
  .chart .b.g{background:var(--gold)}
  table{width:100%;border-collapse:collapse;font-size:.86rem}
  th{font-family:ui-monospace,monospace;font-size:.62rem;text-transform:uppercase;letter-spacing:.12em;color:var(--mut);text-align:left;padding:0 4px 8px}
  td{padding:7px 4px;border-top:1px solid var(--line);color:var(--mut)}
  td.n,th.n{text-align:right;color:var(--txt);font-family:ui-monospace,monospace}
  .foot{color:#5E6874;font-size:.72rem;font-family:ui-monospace,monospace}
  @media(max-width:640px){.cards{grid-template-columns:1fr 1fr}.card .v{font-size:1.4rem}}
</style>
</head>
<body>
<div class="wrap">
  <div class="top"><h1>SPTeknik · Analytics</h1><span class="tag">private · noindex</span></div>
  <div class="notice" id="notice"></div>
  <div class="cards">
    <div class="card"><div class="k">Today · requests</div><div class="v" id="tr">–</div><div class="s" id="tp">pageviews –</div></div>
    <div class="card"><div class="k">Last 7 days · requests</div><div class="v" id="wr">–</div><div class="s" id="wp">pageviews –</div></div>
    <div class="card"><div class="k">Last 30 days · requests</div><div class="v" id="mr">–</div><div class="s" id="mp">pageviews –</div></div>
  </div>
  <div class="panel"><h2>Requests · last 30 days</h2><div class="chart" id="chart"></div></div>
  <div class="panel"><h2>Daily detail</h2>
    <table><thead><tr><th>date</th><th class="n">requests</th><th class="n">pageviews</th></tr></thead><tbody id="tbody"></tbody></table>
  </div>
  <p class="foot">data: cloudflare zone analytics · served by the spteknik worker · <span id="upd"></span></p>
</div>
<script>
var el = function(id){ return document.getElementById(id); };
fetch('/api/summary', {cache:'no-store'}).then(function(r){ return r.json(); }).then(function(d){
  if (d.error) {
    var n = el('notice');
    n.style.display = 'block';
    n.textContent = 'API: ' + d.error + ' — grant the missing Cloudflare token permission and reload.';
    return;
  }
  var days = d.days || [];
  var sum = function(n, k){ return days.slice(-n).reduce(function(t, x){ return t + x[k]; }, 0); };
  var fmt = function(x){ return x.toLocaleString('en-US'); };
  el('tr').textContent = fmt(sum(1, 'requests')); el('tp').textContent = 'pageviews ' + fmt(sum(1, 'pageviews'));
  el('wr').textContent = fmt(sum(7, 'requests')); el('wp').textContent = 'pageviews ' + fmt(sum(7, 'pageviews'));
  el('mr').textContent = fmt(sum(30, 'requests')); el('mp').textContent = 'pageviews ' + fmt(sum(30, 'pageviews'));
  var max = Math.max.apply(null, days.map(function(x){ return x.requests; }).concat([1]));
  var chart = el('chart');
  days.forEach(function(x){
    var b = document.createElement('div');
    b.className = 'b' + (x.requests === max ? ' g' : '');
    b.title = x.date + ' · ' + fmt(x.requests) + ' req / ' + fmt(x.pageviews) + ' pv';
    b.style.height = Math.max(2, Math.round(x.requests / max * 100)) + '%';
    chart.appendChild(b);
  });
  var tb = el('tbody');
  days.slice().reverse().forEach(function(x){
    var tr = document.createElement('tr');
    tr.innerHTML = '<td>' + x.date + '</td><td class="n">' + fmt(x.requests) + '</td><td class="n">' + fmt(x.pageviews) + '</td>';
    tb.appendChild(tr);
  });
  el('upd').textContent = 'updated ' + new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
});
</script>
</body>
</html>`;

async function cfGraphQL(token: string, query: string): Promise<any> {
  const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return res.json();
}

async function serveAnalyticsSite(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url);

  if (pathname === "/robots.txt") {
    return new Response("User-agent: *\nDisallow: /\n", {
      headers: { ...NOINDEX_HEADERS, "content-type": "text/plain; charset=utf-8" },
    });
  }

  if (pathname === "/favicon.ico") {
    return env.ASSETS.fetch(new Request("https://spteknik.com/favicon.ico"));
  }

  if (pathname === "/api/summary") {
    let payload: unknown;
    if (!env.ANALYTICS_TOKEN) {
      payload = { error: "ANALYTICS_TOKEN secret is not configured on the worker" };
    } else {
      const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
      const until = new Date().toISOString().slice(0, 10);
      const q = `query {
        viewer {
          zones(filter: {zoneTag: "${ZONE_ID}"}) {
            httpRequests1dGroups(limit: 40, filter: {date_geq: "${since}", date_leq: "${until}"}, orderBy: [date_ASC]) {
              dimensions { date }
              sum { requests pageViews }
            }
          }
        }
      }`;
      const r = await cfGraphQL(env.ANALYTICS_TOKEN, q);
      const errors = r.errors as { message: string }[] | undefined;
      const groups = r?.data?.viewer?.zones?.[0]?.httpRequests1dGroups;
      if (errors?.length) {
        payload = { error: errors[0].message, days: [] };
      } else {
        payload = {
          days: (groups ?? []).map((g: any) => ({
            date: g.dimensions.date,
            requests: g.sum.requests,
            pageviews: g.sum.pageViews,
          })),
        };
      }
    }
    return new Response(JSON.stringify(payload), {
      headers: { ...NOINDEX_HEADERS, "content-type": "application/json" },
    });
  }

  return new Response(ANALYTICS_HTML, {
    headers: { ...NOINDEX_HEADERS, "content-type": "text/html; charset=utf-8" },
  });
}

async function serveMaintenance(request: Request, env: Env): Promise<Response> {
  // fetch the maintenance page from the asset layer (extensionless form —
  // /maintenance.html gets 307'd by html_handling), re-wrap as 503
  const res = await env.ASSETS.fetch(new Request(new URL("/maintenance", request.url).toString(), request));
  const body = await res.arrayBuffer();
  return new Response(body, {
    status: 503,
    headers: {
      "content-type": res.headers.get("content-type") || "text/html; charset=utf-8",
      "retry-after": "3600",
      "cache-control": "no-store",
    },
  });
}

export default {
  async fetch(request, env): Promise<Response> {
    const { pathname, hostname } = new URL(request.url);

    // private analytics dashboard on its own hostname (works even in maintenance mode)
    if (hostname === ANALYTICS_HOST) return serveAnalyticsSite(request, env);

    if (MAINTENANCE_MODE) {
      const allowed = MAINTENANCE_ALLOWED.some((p) => pathname.startsWith(p));
      if (!allowed) return serveMaintenance(request, env);
      return env.ASSETS.fetch(request);
    }

    const mapped = REDIRECTS[pathname];
    if (mapped) return redirect(mapped, request);

    if (DEAD_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + "?"))) {
      return redirect("/", request);
    }

    // any other legacy WordPress path → homepage (soft landing, keeps crawl equity)
    if (pathname.startsWith("/wp-content/") || pathname.startsWith("/wp-includes/") || pathname.endsWith(".php")) {
      return redirect("/", request);
    }

    // everything else: static assets layer (honors not_found_handling → /404.html)
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
