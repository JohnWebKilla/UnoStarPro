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
] as const;

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
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
          response.cookies.set({
            name,
            value,
            ...options,
            sameSite: options.sameSite as "lax" | "strict" | "none" | undefined,
          });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({
            name,
            value: "",
            ...options,
            maxAge: 0,
          });
        },
      },
    }
  );

  try {
    // Get session
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // Check if the current path is a protected route
    const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
      request.nextUrl.pathname.startsWith(route)
    );

    if (isProtectedRoute && !session) {
      // Store the original URL to redirect back after login
      const redirectUrl = new URL("/sign-in", request.url);
      redirectUrl.searchParams.set("redirectTo", request.nextUrl.pathname);

      return NextResponse.redirect(redirectUrl);
    }

    return response;
  } catch (error) {
    console.error("Auth middleware error:", error);

    if (
      PROTECTED_ROUTES.some((route) =>
        request.nextUrl.pathname.startsWith(route)
      )
    ) {
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }

    return response;
  }
}

export const config = {
  matcher: [
    ...PROTECTED_ROUTES.map((route) => `${route}/:path*`),
    "/sign-in",
    "/sign-up",
    "/api/cache",
    "/api/drivers/:path*",
    "/api/companies/:path*",
    "/api/users/:path*",
  ],
};
