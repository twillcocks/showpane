export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedPortal } from "@/lib/client-auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Login page: if already authenticated, redirect to portal
  if (pathname === "/client") {
    try {
      const portal = await getAuthenticatedPortal(req);
      if (portal) {
        return NextResponse.redirect(new URL(`/client/${portal.slug}`, req.url));
      }
    } catch (e) {
      console.error("Middleware: DB error checking auth on login page", e);
      // Fail open — show the login page
    }
    return NextResponse.next();
  }

  // Share link routes handle their own token verification
  if (pathname.includes("/s/")) {
    return NextResponse.next();
  }

  // API routes and static files pass through
  if (pathname.startsWith("/api/") || pathname.startsWith("/_next/")) {
    return NextResponse.next();
  }

  // Portal pages require authentication
  if (pathname.startsWith("/client/")) {
    try {
      const portal = await getAuthenticatedPortal(req);
      if (!portal) {
        const loginUrl = new URL("/client", req.url);
        const requestedSlug = pathname.split("/")[2];
        if (requestedSlug) {
          loginUrl.searchParams.set("portal", requestedSlug);
        }
        return NextResponse.redirect(loginUrl);
      }
      // Ensure the URL slug matches the authenticated slug
      const urlSlug = pathname.split("/")[2];
      if (urlSlug !== portal.slug) {
        return NextResponse.redirect(new URL(`/client/${portal.slug}`, req.url));
      }
      return NextResponse.next();
    } catch (e) {
      console.error("Middleware: DB error checking auth on portal page", e);
      // Fail closed — redirect to login
      const loginUrl = new URL("/client", req.url);
      const requestedSlug = pathname.split("/")[2];
      if (requestedSlug) {
        loginUrl.searchParams.set("portal", requestedSlug);
      }
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|.*\\..*).*)",
    "/(api|trpc)(.*)",
  ],
};
