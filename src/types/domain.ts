export type Role = "cuisine" | "serveur" | "admin" | "proprio";

export type OrderStatus = "received" | "preparing" | "ready";

export type ServerCallStatus = "pending" | "acknowledged" | "closed";

export type ServerCallReason = "addition" | "aide" | "demande_speciale";

export type Locale = "fr" | "en";

export type CategorySlug =
  | "entrees-salades"
  | "burgers"
  | "pates"
  | "viandes"
  | "volailles"
  | "poissons"
  | "pizzas"
  | "cocktails-sans-alcool"
  | "brunch";

export interface Restaurant {
  id: string;
  nom: string;
  logo: string | null;
  adresse: string;
}

export interface Table {
  id: string;
  numero: number;
  qr_code: string;
  access_token?: string;
  statut: "active" | "inactive";
  restaurant_id: string;
}

export interface Category {
  id: string;
  nom: string;
  slug: CategorySlug;
  icone: string;
  ordre: number;
  restaurant_id: string;
}

export interface Subcategory {
  id: string;
  nom: string;
  ordre: number;
  categorie_id: string;
  restaurant_id: string;
}

export interface MenuItem {
  id: string;
  nom: string;
  description: string;
  prix: number;
  photo: string | null;
  categorie_id: string;
  subcategorie_id: string | null;
  disponible: boolean;
  allergenes: string[];
  a_accompagnement: boolean;
  restaurant_id: string;
  plat_du_jour: boolean;
}

export interface PizzaSize {
  id: string;
  item_id: string;
  taille: string;
  prix: number;
}

export interface Accompaniment {
  id: string;
  nom: string;
  prix_supplement: number;
  ordre: number;
  restaurant_id: string;
}

export interface Promotion {
  id: string;
  item_id: string;
  type: "percent" | "amount";
  valeur: number;
  date_debut: string;
  date_fin: string;
  active: boolean;
  restaurant_id: string;
}

export interface UserProfile {
  id: string;
  role: Role;
  restaurant_id: string;
  prenom: string;
  nom: string;
}

export interface Order {
  id: string;
  table_id: string;
  restaurant_id: string;
  statut: OrderStatus;
  heure: string;
  total: number;
  eta_minutes: number | null;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  item_id: string;
  quantite: number;
  note: string | null;
  accompagnement_id: string | null;
  pizza_size_id: string | null;
  prix_unitaire: number;
  supplement: number;
}

export interface ServerCall {
  id: string;
  table_id: string;
  restaurant_id: string;
  motif: ServerCallReason;
  details: string | null;
  statut: ServerCallStatus;
  heure: string;
}

export interface Rating {
  id: string;
  order_id: string;
  note: number;
  commentaire: string | null;
  created_at: string;
}

export interface CartLine {
  lineId: string;
  item: MenuItem;
  quantity: number;
  note: string;
  accompanimentId: string | null;
  accompanimentLabel: string | null;
  accompanimentPrice: number;
  pizzaSizeId: string | null;
  pizzaSizeLabel: string | null;
  pizzaSizePrice: number;
}

export interface KitchenOrderLine {
  id: string;
  quantite: number;
  note: string | null;
  prix_unitaire: number;
  supplement: number;
  item: Pick<MenuItem, "id" | "nom">;
  accompaniment: Pick<Accompaniment, "id" | "nom"> | null;
  pizza_size: Pick<PizzaSize, "id" | "taille"> | null;
}

export interface KitchenOrder {
  id: string;
  statut: OrderStatus;
  heure: string;
  eta_minutes: number | null;
  total: number;
  table: Pick<Table, "id" | "numero">;
  lines: KitchenOrderLine[];
}
