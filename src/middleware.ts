import { auth } from "@/lib/auth";
import { NextResponse, NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
console.log("Routing config:", JSON.stringify(routing, null, 2));

const intlMiddleware = createMiddleware(routing);

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  console.log(`\n[Proxy] INCOMING: ${req.method} ${req.url}`);
  console.log(`[Proxy] Cookies: ${req.headers.get("cookie") || "None"}`);
  console.log(
    `[Proxy] Accept-Language: ${req.headers.get("accept-language") || "None"}`
  );

  // Proxy-aware URL handling - DISABLED
  // const forwardedHost = req.headers.get("x-forwarded-host");
  // const forwardedProto = req.headers.get("x-forwarded-proto");

  // if (forwardedHost) console.log(`[Proxy] X-Forwarded-Host: ${forwardedHost}`);
  // if (forwardedProto) console.log(`[Proxy] X-Forwarded-Proto: ${forwardedProto}`);

  // if (forwardedHost || forwardedProto) {
  //   const url = new URL(req.url);
  //   if (forwardedHost) url.host = forwardedHost;
  //   if (forwardedProto) url.protocol = forwardedProto;

  //   // Clone request with updated URL to ensure next-intl and other logic sees the correct public URL
  //   req = new NextRequest(url, req);
  // }

  const session = await auth();
  const isAuth = !!session?.user;
  (req as any).auth = session; // Polyfill for existing logic validation

  const isPregameRoute = req.nextUrl.pathname.includes("/pregame");
  const isAdminRoute = req.nextUrl.pathname.includes("/admin");
  const isOnboardingRoute = req.nextUrl.pathname.includes("/onboarding");
  const isApiAuthRoute = req.nextUrl.pathname.includes("/api/auth");

  // Debug logging
  console.log(
    `[Proxy] ${req.method} ${req.nextUrl.pathname} (Auth: ${isAuth})`
  );

  // Helper using standard URL constructor which inherits protocol/host from req.url
  const getRedirectUrl = (path: string) => new URL(path, req.url);

  // Redirect root to lobby immediately - DISABLED (Let next-intl handle parsing or page.tsx)
  // if (req.nextUrl.pathname === "/") {
  //   console.log(`[Proxy] Root -> /lobby`);
  //   return NextResponse.redirect(getRedirectUrl("/lobby"));
  // }

  // Redirect logged-in users away from auth pages
  if (isAuth) {
    const user = (req as any).auth?.user;
    if (isOnboardingRoute && user?.username) {
      console.log(`[Proxy] Redirecting Onboarding -> /lobby`);
      return NextResponse.redirect(getRedirectUrl("/lobby"));
    }
  }

  // 1. Auth Checks
  if (isPregameRoute && !isAuth) {
    const signInUrl = getRedirectUrl("/");
    return NextResponse.redirect(signInUrl);
  }

  if (isAdminRoute) {
    if (!isAuth || (req as any).auth?.user?.role !== "ADMIN") {
      // Rewrite to 404 to hide the route existence
      const url = req.nextUrl.clone();
      url.pathname = "/404";
      return NextResponse.rewrite(url);
    }
  }

  // 2. Onboarding Check
  if (isAuth && !isOnboardingRoute && !isApiAuthRoute) {
    const user = (req as any).auth?.user;
    // Note: user.username comes from JWT callback in auth.ts
    if (!user?.username) {
      console.log(`[Proxy] Missing Username -> /onboarding`);
      return NextResponse.redirect(getRedirectUrl("/onboarding"));
    }
  }

  const response = intlMiddleware(req);
  console.log(`[Proxy] Intl Response: Status=${response.status}`);
  console.log(
    `[Proxy] Intl Location: ${response.headers.get("Location") || "None"}`
  );
  console.log(
    `[Proxy] Intl Rewrite: ${
      response.headers.get("x-middleware-rewrite") || "None"
    }`
  );
  console.log(
    `[Proxy] Set-Cookie: ${response.headers.get("set-cookie") || "None"}`
  );

  return response;
}

export const config = {
  // Match all pathnames except for
  // - … if they start with `/api`, `/_next` or `/_vercel`
  // - … the ones containing a dot (e.g. `favicon.ico`)
  matcher: ["/((?!api|_next|_vercel|.*\\..*|socket.io).*)"],
};
