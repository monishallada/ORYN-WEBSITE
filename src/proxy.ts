import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Runs before platform and auth pages:
 *  1. Optimistic auth redirect for /app — a missing session cookie goes
 *     straight to sign-in. This is only a UX shortcut; every page, action,
 *     and API route still verifies the session and permissions on the server.
 *  2. A per-request nonce-based Content Security Policy for the platform.
 *     Marketing pages are static and keep the global headers from
 *     next.config.ts.
 */

const TILE_HOSTS = [
  "https://basemap.nationalmap.gov",
  "https://hazards.fema.gov",
  "https://tiles.openfreemap.org",
].join(" ");

function csp(nonce: string): string {
  const dev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Inline style attributes are required by React style props and MapLibre.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: ${TILE_HOSTS}`,
    `connect-src 'self' ${TILE_HOSTS}${dev ? " ws:" : ""}`,
    "worker-src 'self' blob:",
    "child-src blob:",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/app" || pathname.startsWith("/app/")) {
    if (!getSessionCookie(request, { cookiePrefix: "oryn" })) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
      return NextResponse.redirect(url);
    }
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = csp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: [
    {
      source: "/(app|login|invite|forgot-password|reset-password)(.*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
