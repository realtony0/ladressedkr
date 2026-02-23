import type { CategorySlug, OrderStatus, Role, ServerCallReason } from "@/types/domain";

export const BRAND = {
  name: "L'Adresse Dakar",
  colors: {
    sage: "#7A9E7E",
    darkGreen: "#2D4A2D",
    cream: "#F5F2EC",
    black: "#1A1A1A",
    gold: "#C9A84C",
    lightGray: "#E8E8E8",
  },
} as const;

export const ACCOMPANIMENT_REQUIRED_SLUGS: CategorySlug[] = [
  "viandes",
  "volailles",
  "poissons",
];

export const ORDER_STATUS_FLOW: OrderStatus[] = ["received", "preparing", "ready"];

export const SERVER_CALL_REASONS: ServerCallReason[] = ["addition", "aide", "demande_speciale"];

export const ROLE_LABELS: Record<Role, string> = {
  cuisine: "Cuisine",
  serveur: "Serveur",
  admin: "Admin",
  proprio: "Propriétaire",
};

export const ROUTE_ROLE_RULES: Array<{ prefix: string; roles: Role[] }> = [
  { prefix: "/cuisine", roles: ["cuisine", "admin", "proprio"] },
  { prefix: "/serveur", roles: ["cuisine", "admin", "proprio"] },
  { prefix: "/admin", roles: ["admin", "proprio"] },
  { prefix: "/proprio", roles: ["proprio"] },
  { prefix: "/commande", roles: ["cuisine", "serveur", "admin", "proprio"] },
  { prefix: "/appel-serveur", roles: ["cuisine", "serveur", "admin", "proprio"] },
];

export const DEFAULT_DELAY_ALERT_MINUTES = 18;
export const MIN_STAFF_PASSWORD_LENGTH = 12;

export const LOCAL_STORAGE_KEYS = {
  locale: "ladresse.locale",
  cart: (tableNumber: string) => `ladresse.cart.${tableNumber}`,
  orderHistory: (tableNumber: string) => `ladresse.orders.${tableNumber}`,
};

export const DEFAULT_BRUNCH_WINDOW = {
  start: "10:30:00",
  end: "14:30:00",
};
