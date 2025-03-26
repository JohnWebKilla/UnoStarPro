import { Role } from "@/types/role";

export function getDashboardUrl(role: Role): string {
  const dashboardUrls: Record<Role, string> = {
    admin: "/Dashboard",
    user: "/Dashboard",
    customer: "/Dashboard",
    driver: "/Dashboard",
    superadmin: "/Dashboard",
  };

  return dashboardUrls[role] || "/Dashboard";
}
