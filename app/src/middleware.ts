export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSlug } from "@/lib/client-auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Login page: if already authenticated, redirect to portal
  if (pathname === "/client") {
    try {
      const slug = await getAuthenticatedSlug(req);
      if (slug) {
        return NextResponse.redirect(new URL(`/client/${slug}`, req.url));
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
      const authenticatedSlug = await getAuthenticatedSlug(req);
      if (!authenticatedSlug) {
        return NextResponse.redirect(new URL("/client", req.url));
      }
      // Ensure the URL slug matches the authenticated slug
      const urlSlug = pathname.split("/")[2];
      if (urlSlug !== authenticatedSlug) {
        return NextResponse.redirect(new URL("/client", req.url));
      }
      return NextResponse.next();
    } catch (e) {
      console.error("Middleware: DB error checking auth on portal page", e);
      // Fail closed — redirect to login
      return NextResponse.redirect(new URL("/client", req.url));
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
