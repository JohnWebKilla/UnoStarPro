type Role = "admin" | "manager" | "driver" | "customer";

export function getDashboardUrl(role?: string): string {
  switch (role as Role) {
    case "admin":
      return "/Dashboard";
    case "manager":
      return "/Dashboard";
    case "driver":
      return "/driver-dashboard";
    case "customer":
      return "/customer-dashboard";
    default:
      return "/Dashboard";
  }
}
