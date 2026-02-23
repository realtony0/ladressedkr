import type { Role } from "@/types/domain";

export function routeForRole(role: Role) {
  switch (role) {
    case "cuisine":
      return "/cuisine";
    case "serveur":
      return "/cuisine";
    case "admin":
      return "/admin";
    case "proprio":
      return "/proprio";
    default:
      return "/staff/login";
  }
}
