import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  protectedRoutes,
  authPages,
  AUTH_ROUTES,
  isProtectedRoute,
  hasAccessToRoute,
  getAllowedRoutesForRole,
  getDashboardForRole,
} from "@/utils/protected";
import type { Role } from "@/types/role";

export async function updateSession(request: NextRequest) {
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
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
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
          });
        },
      },
    }
  );

  // Add ROUTES to the public paths that should skip middleware
  if (
    request.nextUrl.pathname.startsWith("/api/webhooks") ||
    request.nextUrl.pathname.startsWith("/_next/static") ||
    request.nextUrl.pathname.startsWith("/_next/image") ||
    request.nextUrl.pathname === "/favicon.ico"
  ) {
    return response;
  }

  // Refresh session if needed
  await supabase.auth.getSession();

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
}
