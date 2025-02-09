import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { CookieOptions } from "@supabase/ssr";
import {
  protectedRoutes,
  authPages,
  isProtectedRoute,
  getDashboardForRole,
  hasAccessToRoute,
  type Role,
  AUTH_ROUTES,
  getAllowedRoutesForRole,
} from "@/utils/protected";

export const updateSession = async (request: NextRequest) => {
  // Add ROUTES to the public paths that should skip middleware
  if (
    request.nextUrl.pathname.startsWith("/_next") ||
    request.nextUrl.pathname.startsWith("/api") ||
    request.nextUrl.pathname.includes(".") ||
    request.headers.get("upgrade") === "websocket" ||
    request.nextUrl.pathname === "/unauthorized" ||
    request.nextUrl.pathname === AUTH_ROUTES.SIGN_IN || // Use constant instead of hardcoded string
    request.nextUrl.pathname === AUTH_ROUTES.SIGN_UP
  ) {
    return NextResponse.next();
  }

  try {
    let response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

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
              sameSite: options.sameSite as
                | "lax"
                | "strict"
                | "none"
                | undefined,
            });
          },
          remove(name: string, options: CookieOptions) {
            response.cookies.delete({
              name,
              ...options,
              sameSite: options.sameSite as
                | "lax"
                | "strict"
                | "none"
                | undefined,
            });
          },
        },
      }
    );

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    const currentPath = request.nextUrl.pathname;

    // Handle unauthenticated users
    if (error || !user) {
      if (isProtectedRoute(currentPath)) {
        return NextResponse.redirect(new URL("/sign-in", request.url));
      }
      return response;
    }

    // Get user role
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }

    const userRole = userData.role as Role;

    // Handle root and auth pages more precisely
    if (
      currentPath === AUTH_ROUTES.HOME ||
      authPages.includes(currentPath as any)
    ) {
      const dashboardUrl = getDashboardForRole(userRole);
      const config = Object.values(protectedRoutes).find((route) =>
        route.allowedRoles.includes(userRole)
      );

      if (!config) {
        return NextResponse.redirect(new URL("/unauthorized", request.url));
      }

      // Redirect to the appropriate dashboard
      if (currentPath !== config.dashboard) {
        return NextResponse.redirect(new URL(config.dashboard, request.url));
      }
    }

    // Check access to protected routes with more specific error handling
    if (isProtectedRoute(currentPath)) {
      if (!hasAccessToRoute(currentPath, userRole)) {
        // Get the user's allowed routes for better error messaging
        const allowedRoutes = getAllowedRoutesForRole(userRole);
        console.warn(
          `User with role ${userRole} attempted to access ${currentPath}. Allowed routes:`,
          allowedRoutes
        );
        return NextResponse.redirect(new URL("/unauthorized", request.url));
      }
    }

    return response;
  } catch (e) {
    console.error("Middleware error:", e);
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    });
  }
};
