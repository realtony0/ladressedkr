/* eslint-disable @typescript-eslint/no-explicit-any */
import { isWithinInterval, parseISO } from "date-fns";

import { DEFAULT_BRUNCH_WINDOW } from "@/lib/helpers/constants";
import {
  seedAccompaniments,
  seedCategories,
  seedItems,
  seedPizzaSizes,
  seedPromotions,
  seedRestaurantId,
  seedSubcategories,
} from "@/lib/data/menu-seed";
import { DEFAULT_RESTAURANT_ID } from "@/lib/supabase/env";
import type {
  Accompaniment,
  Category,
  MenuItem,
  PizzaSize,
  Promotion,
  Subcategory,
} from "@/types/domain";

export interface ServiceHours {
  id: string;
  service_type: "service" | "brunch";
  open_time: string;
  close_time: string;
  enabled: boolean;
}

export interface MenuCatalog {
  restaurantId: string;
  categories: Category[];
  subcategories: Subcategory[];
  items: MenuItem[];
  accompaniments: Accompaniment[];
  pizzaSizes: PizzaSize[];
  promotions: Promotion[];
  serviceHours: ServiceHours[];
}

function getSeedCatalog(restaurantId: string): MenuCatalog {
  return {
    restaurantId,
    categories: seedCategories,
    subcategories: seedSubcategories,
    items: seedItems,
    accompaniments: seedAccompaniments,
    pizzaSizes: seedPizzaSizes,
    promotions: seedPromotions,
    serviceHours: [
      {
        id: "service-brunch-default",
        service_type: "brunch",
        open_time: DEFAULT_BRUNCH_WINDOW.start,
        close_time: DEFAULT_BRUNCH_WINDOW.end,
        enabled: true,
      },
    ],
  };
}

export function getFallbackCatalog(restaurantId: string) {
  return getSeedCatalog(restaurantId);
}

export function getEffectiveRestaurantId(restoId?: string) {
  return restoId || DEFAULT_RESTAURANT_ID || seedRestaurantId;
}

export function isBrunchCurrentlyOpen(hours: ServiceHours[]) {
  const brunchHours = hours.find((hour) => hour.service_type === "brunch" && hour.enabled);
  if (!brunchHours) {
    return true;
  }

  const now = new Date();
  const dateISO = now.toISOString().slice(0, 10);
  const start = parseISO(`${dateISO}T${brunchHours.open_time}`);
  const end = parseISO(`${dateISO}T${brunchHours.close_time}`);

  return isWithinInterval(now, { start, end });
}

export function activePromotionForItem(itemId: string, promotions: Promotion[]) {
  const now = new Date();
  return promotions.find((promo) => {
    if (!promo.active || promo.item_id !== itemId) {
      return false;
    }

    return now >= new Date(promo.date_debut) && now <= new Date(promo.date_fin);
  });
}

type PromotionLike = Pick<Promotion, "type" | "valeur">;

export function applyPromotion(basePrice: number, promotion?: PromotionLike) {
  if (!promotion) {
    return basePrice;
  }

  if (promotion.type === "amount") {
    return Math.max(0, basePrice - promotion.valeur);
  }

  const reduction = (basePrice * promotion.valeur) / 100;
  return Math.max(0, basePrice - reduction);
}

export async function loadCatalog({
  supabase,
  restaurantId,
  allowFallback = false,
}: {
  supabase: any | null;
  restaurantId?: string;
  allowFallback?: boolean;
}): Promise<MenuCatalog> {
  const currentRestaurant = getEffectiveRestaurantId(restaurantId);

  if (!supabase) {
    if (!allowFallback) {
      throw new Error("SUPABASE_UNAVAILABLE");
    }
    return getFallbackCatalog(currentRestaurant);
  }

  try {
    const [categoriesResult, subcategoriesResult, itemsResult, accompanimentsResult, sizesResult, promotionsResult, hoursResult] =
      await Promise.all([
        supabase.from("categories").select("*").eq("restaurant_id", currentRestaurant).order("ordre", { ascending: true }),
        supabase.from("subcategories").select("*").eq("restaurant_id", currentRestaurant).order("ordre", { ascending: true }),
        supabase.from("items").select("*").eq("restaurant_id", currentRestaurant).order("nom", { ascending: true }),
        supabase
          .from("accompaniments")
          .select("*")
          .eq("restaurant_id", currentRestaurant)
          .order("ordre", { ascending: true }),
        supabase.from("pizza_sizes").select("*").order("taille", { ascending: true }),
        supabase
          .from("promotions")
          .select("*")
          .eq("restaurant_id", currentRestaurant)
          .eq("active", true)
          .gte("date_fin", new Date().toISOString())
          .lte("date_debut", new Date().toISOString()),
        supabase.from("service_hours").select("*").eq("restaurant_id", currentRestaurant).order("service_type"),
      ]);

    if (
      categoriesResult.error ||
      subcategoriesResult.error ||
      itemsResult.error ||
      accompanimentsResult.error ||
      sizesResult.error ||
      promotionsResult.error ||
      hoursResult.error
    ) {
      if (!allowFallback) {
        const message =
          categoriesResult.error?.message ||
          subcategoriesResult.error?.message ||
          itemsResult.error?.message ||
          accompanimentsResult.error?.message ||
          sizesResult.error?.message ||
          promotionsResult.error?.message ||
          hoursResult.error?.message ||
          "CATALOG_LOAD_FAILED";
        throw new Error(message);
      }
      return getFallbackCatalog(currentRestaurant);
    }

    return {
      restaurantId: currentRestaurant,
      categories: (categoriesResult.data ?? []) as Category[],
      subcategories: (subcategoriesResult.data ?? []) as Subcategory[],
      items: (itemsResult.data ?? []) as MenuItem[],
      accompaniments: (accompanimentsResult.data ?? []) as Accompaniment[],
      pizzaSizes: (sizesResult.data ?? []) as PizzaSize[],
      promotions: (promotionsResult.data ?? []) as Promotion[],
      serviceHours: (hoursResult.data ?? []) as ServiceHours[],
    };
  } catch (error) {
    if (!allowFallback) {
      throw error;
    }
    return getFallbackCatalog(currentRestaurant);
  }
}
