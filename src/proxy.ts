import { NextResponse, type NextRequest } from "next/server";
import { serviceSlugIsPublic } from "@/server/slug-check";

/**
 * 1. /admin: cheap first gate. No session cookie means go to login. This is NOT the security boundary:
 *    every admin page and server action re-validates the session and role against the database.
 * 2. /services/:slug: unknown or disabled services get a real HTTP 404. Without this, the page would
 *    start streaming before the database lookup finished and respond 200 (a "soft 404").
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const service = pathname.match(/^\/services\/([^/]+)\/?$/);
  if (service) {
    const ok = await serviceSlugIsPublic(decodeURIComponent(service[1])).catch(() => true); // on DB error, let the page decide
    return ok ? NextResponse.next() : NextResponse.rewrite(new URL("/__not-found__", request.url));
  }

  if (pathname === "/admin/login") return NextResponse.next();
  if (!request.cookies.get("cx_session")) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  const res = NextResponse.next();
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = { matcher: ["/admin/:path*", "/services/:slug"] };
