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
    const { pathname } = new URL(request.url);

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
