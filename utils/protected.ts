import { Role } from "@/types/role";

// Define all possible routes as constants to avoid typos
export const ROUTES = {
  DASHBOARD: "/Dashboard",
  COMPANIES: "/Companies",
  DRIVERS: "/Drivers",
  PAYCHECKS: "/Paychecks",
  REPORTS: "/Reports",
  TICKETS: "/Tickets",
  USERS: "/Users",
  SETTINGS: "/Settings",
  PROFILE: "/Profile",
} as const;

// Define auth pages separately
export const AUTH_ROUTES = {
  SIGN_IN: "/sign-in",
  SIGN_UP: "/sign-up",
  HOME: "/",
} as const;

type RouteConfig = {
  path: string;
  dashboard: string;
  allowedRoles: Role[];
  allowedRoutes: {
    path: string;
    roles: Role[];
    description?: string; // Optional description for documentation
  }[];
};

// Define protected routes and their configurations
export const protectedRoutes: Record<string, RouteConfig> = {
  admin: {
    path: ROUTES.DASHBOARD,
    dashboard: ROUTES.DASHBOARD,
    allowedRoles: ["admin", "superadmin"],
    allowedRoutes: [
      {
        path: ROUTES.DASHBOARD,
        roles: ["admin", "superadmin"],
        description: "Admin Dashboard",
      },
      {
        path: ROUTES.USERS,
        roles: ["admin"],
        description: "User management page",
      },
      {
        path: ROUTES.SETTINGS,
        roles: ["admin"],
        description: "System settings page",
      },
      {
        path: ROUTES.COMPANIES,
        roles: ["admin"],
        description: "Companies management page",
      },
      {
        path: ROUTES.DRIVERS,
        roles: ["admin"],
        description: "Drivers management page",
      },
      {
        path: ROUTES.PAYCHECKS,
        roles: ["admin"],
        description: "Paycheck management page",
      },
      {
        path: ROUTES.REPORTS,
        roles: ["admin"],
        description: "Reports page",
      },
    ],
  },
  user: {
    path: ROUTES.DASHBOARD,
    dashboard: ROUTES.DASHBOARD,
    allowedRoles: ["user"],
    allowedRoutes: [
      {
        path: ROUTES.DASHBOARD,
        roles: ["user"],
        description: "User Dashboard",
      },
    ],
  },
  driver: {
    path: ROUTES.DASHBOARD,
    dashboard: ROUTES.DASHBOARD,
    allowedRoles: ["driver"],
    allowedRoutes: [
      {
        path: ROUTES.DASHBOARD,
        roles: ["driver"],
        description: "Driver Dashboard",
      },
      {
        path: ROUTES.TICKETS,
        roles: ["driver"],
        description: "Driver tickets page",
      },
      {
        path: ROUTES.PROFILE,
        roles: ["driver"],
        description: "Driver profile page",
      },
    ],
  },
  customer: {
    path: ROUTES.DASHBOARD,
    dashboard: ROUTES.DASHBOARD,
    allowedRoles: ["customer"],
    allowedRoutes: [
      {
        path: ROUTES.DASHBOARD,
        roles: ["customer"],
        description: "Customer Dashboard",
      },
      {
        path: ROUTES.PROFILE,
        roles: ["customer"],
        description: "Customer profile page",
      },
    ],
  },
};

export const authPages = Object.values(AUTH_ROUTES);

export function isProtectedRoute(path: string): boolean {
  // First check if it's an auth page
  if (authPages.includes(path as any)) return false;

  return Object.values(protectedRoutes).some((config) => {
    // Check main path
    if (path.startsWith(config.path)) return true;
    // Check allowed routes
    return config.allowedRoutes.some((route) => path.startsWith(route.path));
  });
}

export function getDashboardForRole(role: Role): string {
  const route = Object.values(protectedRoutes).find((config) =>
    config.allowedRoles.includes(role)
  );
  return route?.dashboard || "/unauthorized";
}

export function hasAccessToRoute(path: string, role: Role): boolean {
  // Allow access to auth pages
  if (authPages.includes(path as any)) return true;

  const route = Object.values(protectedRoutes).find(
    (config) =>
      path.startsWith(config.path) ||
      config.allowedRoutes.some((route) => path.startsWith(route.path))
  );

  if (!route) return false;

  // Check specific route permissions first
  const specificRoute = route.allowedRoutes.find((r) =>
    path.startsWith(r.path)
  );
  if (specificRoute) {
    return specificRoute.roles.includes(role);
  }

  // Fall back to general role-based access
  return route.allowedRoles.includes(role);
}

// Helper function to get all allowed routes for a role
export function getAllowedRoutesForRole(role: Role): string[] {
  console.log("Getting routes for role:", role);

  const configs = Object.values(protectedRoutes).filter((config) =>
    config.allowedRoles.includes(role)
  );

  console.log("Matching configs:", configs);

  const routes = configs.flatMap((config) => {
    const allowedRoutes = config.allowedRoutes
      .filter((route) => route.roles.includes(role))
      .map((route) => route.path);
    console.log("Config allowed routes:", allowedRoutes);
    return allowedRoutes;
  });

  console.log(`Final routes for role ${role}:`, routes);
  return routes;
}
