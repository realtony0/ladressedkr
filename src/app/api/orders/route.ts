import { NextResponse } from "next/server";

import { ACCOMPANIMENT_REQUIRED_SLUGS } from "@/lib/helpers/constants";
import { applyPromotion } from "@/lib/data/menu";
import { resolveActiveTableByAccessToken } from "@/lib/data/tables";
import { DEFAULT_RESTAURANT_ID } from "@/lib/supabase/env";
import { getServiceSupabase } from "@/lib/supabase/server";

interface OrderLineInput {
  itemId: string;
  quantity: number;
  note?: string;
  accompanimentId?: string | null;
  pizzaSizeId?: string | null;
}

interface CreateOrderBody {
  tableNumber: number;
  accessToken: string;
  lines: OrderLineInput[];
  restaurantId?: string;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export async function POST(request: Request) {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase service role key manquante. Configure SUPABASE_SERVICE_ROLE_KEY." },
      { status: 500 },
    );
  }

  const body = (await request.json()) as CreateOrderBody;

  if (
    !Number.isFinite(body.tableNumber) ||
    body.tableNumber <= 0 ||
    !body.accessToken?.trim() ||
    !Array.isArray(body.lines) ||
    body.lines.length === 0
  ) {
    return NextResponse.json({ error: "Payload commande invalide." }, { status: 400 });
  }

  const resolvedRestaurantId = body.restaurantId?.trim() || DEFAULT_RESTAURANT_ID || null;
  const tableResolution = await resolveActiveTableByAccessToken<{
    id: string;
    numero: number;
    statut: "active" | "inactive";
    restaurant_id: string;
  }>({
    supabase,
    tableNumber: body.tableNumber,
    accessToken: body.accessToken,
    restaurantId: resolvedRestaurantId,
    select: "id, numero, statut, restaurant_id",
  });

  if (tableResolution.error) {
    return NextResponse.json({ error: tableResolution.error }, { status: 500 });
  }

  const table = tableResolution.table;

  if (!table) {
    return NextResponse.json({ error: "Table introuvable ou QR désactivé." }, { status: 404 });
  }

  const itemIds = Array.from(new Set(body.lines.map((line) => line.itemId)));
  const accompanimentIds = Array.from(
    new Set(body.lines.map((line) => line.accompanimentId).filter(Boolean) as string[]),
  );
  const pizzaSizeIds = Array.from(new Set(body.lines.map((line) => line.pizzaSizeId).filter(Boolean) as string[]));

  const [itemsResult, accompanimentsResult, pizzaSizesResult, promotionsResult] = await Promise.all([
    supabase
      .from("items")
      .select("id, nom, prix, disponible, a_accompagnement, categorie:categories(slug)")
      .eq("restaurant_id", table.restaurant_id)
      .in("id", itemIds),
    accompanimentIds.length > 0
      ? supabase
          .from("accompaniments")
          .select("id, nom, prix_supplement")
          .eq("restaurant_id", table.restaurant_id)
          .in("id", accompanimentIds)
      : Promise.resolve({ data: [], error: null }),
    pizzaSizeIds.length > 0
      ? supabase.from("pizza_sizes").select("id, item_id, taille, prix").in("id", pizzaSizeIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("promotions")
      .select("id, item_id, type, valeur, date_debut, date_fin, active")
      .eq("restaurant_id", table.restaurant_id)
      .eq("active", true)
      .gte("date_fin", new Date().toISOString())
      .lte("date_debut", new Date().toISOString()),
  ]);

  type RawMenuItem = {
    id: string;
    prix: number;
    disponible: boolean;
    a_accompagnement: boolean;
    categorie: { slug: string } | Array<{ slug: string }> | null;
  };

  const menuItemsRaw = (itemsResult.data ?? []) as unknown as RawMenuItem[];
  const menuItems = menuItemsRaw.map((item) => ({
    ...item,
    categorie: Array.isArray(item.categorie) ? (item.categorie[0] ?? null) : item.categorie,
  }));

  const accompaniments = (accompanimentsResult.data ?? []) as unknown as Array<{
    id: string;
    prix_supplement: number;
  }>;

  const pizzaSizes = (pizzaSizesResult.data ?? []) as unknown as Array<{
    id: string;
    item_id: string;
    prix: number;
  }>;

  const promotions = (promotionsResult.data ?? []) as unknown as Array<{
    item_id: string;
    type: "percent" | "amount";
    valeur: number;
    date_debut: string;
    date_fin: string;
    active: boolean;
  }>;

  const itemMap = new Map(menuItems.map((item) => [item.id, item]));
  const accompanimentMap = new Map(accompaniments.map((entry) => [entry.id, entry]));
  const sizeMap = new Map(pizzaSizes.map((size) => [size.id, size]));

  let total = 0;
  let totalUnits = 0;
  let hasPizza = false;
  let hasNotes = false;
  const orderLines = [] as Array<{
    item_id: string;
    quantite: number;
    note: string | null;
    accompagnement_id: string | null;
    pizza_size_id: string | null;
    prix_unitaire: number;
    supplement: number;
  }>;

  for (const line of body.lines) {
    const item = itemMap.get(line.itemId);
    if (!item || !item.disponible) {
      return NextResponse.json({ error: "Un plat sélectionné est indisponible." }, { status: 409 });
    }

    const quantity = Math.max(1, Math.floor(line.quantity || 1));
    totalUnits += quantity;

    const accompaniment = line.accompanimentId ? accompanimentMap.get(line.accompanimentId) : null;
    const categorySlug = item.categorie?.slug;
    const accompanimentRequired =
      item.a_accompagnement &&
      categorySlug &&
      ACCOMPANIMENT_REQUIRED_SLUGS.includes(categorySlug as (typeof ACCOMPANIMENT_REQUIRED_SLUGS)[number]);

    if (!accompanimentRequired && accompaniment) {
      return NextResponse.json(
        { error: "Les accompagnements sont disponibles uniquement pour viandes, volailles et poissons." },
        { status: 400 },
      );
    }

    if (accompanimentRequired && !accompaniment) {
      return NextResponse.json(
        { error: "Un accompagnement est obligatoire pour les viandes, volailles et poissons." },
        { status: 400 },
      );
    }

    const size = line.pizzaSizeId ? sizeMap.get(line.pizzaSizeId) : null;
    if (size && size.item_id !== item.id) {
      return NextResponse.json({ error: "Format pizza invalide." }, { status: 400 });
    }
    if (size) {
      hasPizza = true;
    }

    const promotion = promotions.find((promo) => {
      if (promo.item_id !== item.id || !promo.active) {
        return false;
      }
      const now = new Date();
      return now >= new Date(promo.date_debut) && now <= new Date(promo.date_fin);
    });

    const basePrice = size?.prix ?? item.prix;
    const unitPrice = applyPromotion(basePrice, promotion);
    const supplement = accompaniment?.prix_supplement ?? 0;
    const note = line.note?.trim() || null;
    if (note) {
      hasNotes = true;
    }

    total += (unitPrice + supplement) * quantity;

    orderLines.push({
      item_id: item.id,
      quantite: quantity,
      note,
      accompagnement_id: accompaniment?.id ?? null,
      pizza_size_id: size?.id ?? null,
      prix_unitaire: unitPrice,
      supplement,
    });
  }

  const estimatedEtaMinutes = clamp(
    8 + totalUnits * 2 + Math.floor(orderLines.length / 2) + (hasPizza ? 5 : 0) + (hasNotes ? 2 : 0),
    12,
    60,
  );

  const { data: insertedOrder, error: orderInsertError } = await supabase
    .from("orders")
    .insert({
      table_id: table.id,
      restaurant_id: table.restaurant_id,
      statut: "received",
      heure: new Date().toISOString(),
      total,
      eta_minutes: estimatedEtaMinutes,
    })
    .select("id")
    .single();

  if (orderInsertError || !insertedOrder) {
    return NextResponse.json({ error: orderInsertError?.message ?? "Erreur création commande" }, { status: 500 });
  }

  const { error: linesError } = await supabase.from("order_items").insert(
    orderLines.map((line) => ({
      order_id: insertedOrder.id,
      ...line,
    })),
  );

  if (linesError) {
    await supabase.from("orders").delete().eq("id", insertedOrder.id);
    return NextResponse.json({ error: linesError.message }, { status: 500 });
  }

  return NextResponse.json({ orderId: insertedOrder.id, total, etaMinutes: estimatedEtaMinutes });
}
