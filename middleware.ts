import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Define protected routes
const PROTECTED_ROUTES = [
  "/Dashboard",
  "/Drivers",
  "/Vehicles",
  "/Settings",
  "/Reports",
  "/Notifications",
  "/Profile",
  "/Tickets",
  "/Companies",
  "/Users",
  "/Paychecks",
  "/Expenses",
  "/Performance",
  "/Scheduling",
] as const;

export async function middleware(request: NextRequest) {
  // Create a response early with default values
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Create Supabase client with cookie handling
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // Set cookie on the response
          response.cookies.set({
            name,
            value,
            ...options,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
          });
        },
        remove(name: string, options: CookieOptions) {
          // Remove cookie from the response
          response.cookies.set({
            name,
            value: "",
            ...options,
            maxAge: 0,
            path: "/",
          });
        },
      },
    }
  );

  try {
    // Get session with retry logic
    let session;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      const {
        data: { session: currentSession },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error(`Session error attempt ${retryCount + 1}:`, sessionError);
        retryCount++;
        if (retryCount < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 100 * retryCount));
          continue;
        }
        throw sessionError;
      }

      session = currentSession;
      break;
    }

    // Check if trying to access auth pages while authenticated
    if (session) {
      if (
        request.nextUrl.pathname === "/sign-in" ||
        request.nextUrl.pathname === "/sign-up"
      ) {
        return NextResponse.redirect(new URL("/Dashboard", request.url));
      }
      return response;
    }

    // Check if the current path is a protected route
    const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
      request.nextUrl.pathname.startsWith(route)
    );

    if (isProtectedRoute) {
      // Store the original URL to redirect back after login
      const redirectUrl = new URL("/sign-in", request.url);
      redirectUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
      const redirectResponse = NextResponse.redirect(redirectUrl);

      // Copy all cookies from the response to the redirect
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie);
      });

      return redirectResponse;
    }

    return response;
  } catch (error) {
    console.error("Auth middleware error:", error);

    // If there's an error and we're on a protected route, redirect to sign-in
    if (
      PROTECTED_ROUTES.some((route) =>
        request.nextUrl.pathname.startsWith(route)
      )
    ) {
      const redirectResponse = NextResponse.redirect(
        new URL("/sign-in", request.url)
      );

      // Copy all cookies from the response to the redirect
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie);
      });

      return redirectResponse;
    }

    return response;
  }
}

export const config = {
  matcher: [
    "/Dashboard/:path*",
    "/Drivers/:path*",
    "/Vehicles/:path*",
    "/Settings/:path*",
    "/Reports/:path*",
    "/Notifications/:path*",
    "/Profile/:path*",
    "/Tickets/:path*",
    "/Companies/:path*",
    "/Users/:path*",
    "/Paychecks/:path*",
    "/Expenses/:path*",
    "/Performance/:path*",
    "/Scheduling/:path*",
    "/sign-in",
    "/sign-up",
    "/api/cache",
    "/api/drivers/:path*",
    "/api/companies/:path*",
    "/api/users/:path*",
  ],
};
