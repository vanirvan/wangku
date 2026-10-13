import { type NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";

const AUTH_ROUTES = ["/sign-in", "/sign-up", "/login", "/register"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip API routes, auth routes handled by Better Auth
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Check server-side session using Better Auth
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  // If already authenticated and visiting an auth route, redirect to home
  if (isAuthRoute) {
    if (session) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // If unauthenticated, redirect to sign-in page
  if (!session) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export default proxy;

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public file extensions (e.g. svg, png, jpg, jpeg, gif, webp)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
