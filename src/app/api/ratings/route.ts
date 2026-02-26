import { NextResponse } from "next/server";

import { resolveActiveTableByAccessToken } from "@/lib/data/tables";
import { requireStaffApiContext } from "@/lib/helpers/api-auth";
import { DEFAULT_RESTAURANT_ID } from "@/lib/supabase/env";
import { getServiceSupabase } from "@/lib/supabase/server";

interface CreateRatingBody {
  orderId: string;
  note: number;
  commentaire?: string;
  tableNumber?: number;
  accessToken?: string;
  restaurantId?: string;
}

export async function POST(request: Request) {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 });
  }

  const body = (await request.json()) as CreateRatingBody;

  if (!body.orderId || !Number.isFinite(body.note) || body.note < 1 || body.note > 5) {
    return NextResponse.json({ error: "Données de notation invalides" }, { status: 400 });
  }

  let tableIdFilter: string | null = null;
  let restaurantIdFilter: string | null = null;

  const hasClientAccessToken = body.accessToken?.trim() && Number.isFinite(body.tableNumber) && (body.tableNumber ?? 0) > 0;
  if (hasClientAccessToken) {
    const resolvedRestaurantId = body.restaurantId?.trim() || DEFAULT_RESTAURANT_ID || null;
    const tableResolution = await resolveActiveTableByAccessToken<{ id: string }>({
      supabase,
      tableNumber: Number(body.tableNumber),
      accessToken: body.accessToken as string,
      restaurantId: resolvedRestaurantId,
      select: "id",
    });

    if (tableResolution.error) {
      return NextResponse.json({ error: tableResolution.error }, { status: 500 });
    }

    if (!tableResolution.table) {
      return NextResponse.json({ error: "Session QR invalide ou expirée." }, { status: 403 });
    }

    tableIdFilter = tableResolution.table.id;
  } else {
    const context = await requireStaffApiContext(["cuisine", "serveur", "admin", "proprio"]);
    if (context instanceof NextResponse) {
      return context;
    }
    restaurantIdFilter = context.restaurantId;
  }

  let orderQuery = supabase.from("orders").select("id, statut, table_id, restaurant_id").eq("id", body.orderId);
  if (tableIdFilter) {
    orderQuery = orderQuery.eq("table_id", tableIdFilter);
  }
  if (restaurantIdFilter) {
    orderQuery = orderQuery.eq("restaurant_id", restaurantIdFilter);
  }

  const { data: order } = await orderQuery.maybeSingle();

  if (!order) {
    return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
  }

  if (order.statut !== "ready") {
    return NextResponse.json({ error: "La commande doit être prête avant notation" }, { status: 409 });
  }

  const { data: existing } = await supabase
    .from("ratings")
    .select("id")
    .eq("order_id", body.orderId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Notation déjà enregistrée" }, { status: 409 });
  }

  const { error } = await supabase.from("ratings").insert({
    order_id: body.orderId,
    note: body.note,
    commentaire: body.commentaire?.trim() || null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
