import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

export default auth((req) => {
  const isAuth = !!req.auth;
  const isPregameRoute = req.nextUrl.pathname.includes("/pregame");
  const isAdminRoute = req.nextUrl.pathname.includes("/admin");
  const isOnboardingRoute = req.nextUrl.pathname.includes("/onboarding");
  const isRegisterRoute = req.nextUrl.pathname.includes("/register");
  const isApiAuthRoute = req.nextUrl.pathname.includes("/api/auth");

  // Helper to construct URL respecting X-Forwarded-Host
  const getRedirectUrl = (path: string) => {
    const url = req.nextUrl.clone();
    url.pathname = path;
    url.search = ""; // Clear search params by default

    const forwardedHost =
      req.headers.get("x-forwarded-host") || req.headers.get("x-original-host");
    const forwardedProto = req.headers.get("x-forwarded-proto");

    if (forwardedHost) {
      url.host = forwardedHost;
    }
    if (forwardedProto) {
      url.protocol = forwardedProto;
    }

    // Debug log to help troubleshoot tunnel issues
    if (!forwardedHost) {
      console.log("[Middleware] Redirecting to:", url.toString());
      console.log("[Middleware] Headers:", {
        host: req.headers.get("host"),
        xForwardedHost: req.headers.get("x-forwarded-host"),
        xOriginalHost: req.headers.get("x-original-host"),
      });
    }

    return url;
  };

  // Redirect logged-in users away from auth pages
  if (isAuth) {
    const user = req.auth?.user as any;
    if (isRegisterRoute || (isOnboardingRoute && user?.username)) {
      return NextResponse.redirect(getRedirectUrl("/lobby"));
    }
  }

  // 1. Auth Checks
  if (isPregameRoute && !isAuth) {
    const signInUrl = getRedirectUrl("/api/auth/signin");
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (isAdminRoute) {
    if (!isAuth) {
      const signInUrl = getRedirectUrl("/api/auth/signin");
      signInUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
      return NextResponse.redirect(signInUrl);
    }
    if (req.auth?.user?.role !== "ADMIN") {
      return NextResponse.redirect(getRedirectUrl("/"));
    }
  }

  // 2. Onboarding Check
  if (isAuth && !isOnboardingRoute && !isApiAuthRoute && !isRegisterRoute) {
    const user = req.auth?.user as any;
    // Note: user.username comes from JWT callback in auth.ts
    if (!user?.username) {
      return NextResponse.redirect(getRedirectUrl("/onboarding"));
    }
  }

  // 3. Intl Middleware
  return intlMiddleware(req);
});

export const config = {
  // Match all pathnames except for
  // - … if they start with `/api`, `/_next` or `/_vercel`
  // - … the ones containing a dot (e.g. `favicon.ico`)
  matcher: ["/((?!api|_next|_vercel|.*\\..*|socket.io).*)"],
};
