import { NextResponse } from "next/server";

import { resolveActiveTableByNumber } from "@/lib/data/tables";
import { DEFAULT_RESTAURANT_ID } from "@/lib/supabase/env";
import { getServiceSupabase } from "@/lib/supabase/server";

const ORDER_ID_REGEX = /^[0-9a-f-]{8,64}$/i;

function parseHistoryIds(raw: string | null) {
  if (!raw) {
    return [] as string[];
  }
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => ORDER_ID_REGEX.test(entry))
    .slice(0, 50);
}

type HistoryOrderRaw = {
  id: string;
  statut: "received" | "preparing" | "ready";
  heure: string;
  total: number;
  eta_minutes: number | null;
  rating:
    | { id?: string; note?: number | null; commentaire?: string | null }
    | Array<{ id?: string; note?: number | null; commentaire?: string | null }>
    | null;
};

export async function GET(request: Request) {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const tableNumber = Number(searchParams.get("tableNumber"));
  const historyIds = parseHistoryIds(searchParams.get("historyIds"));
  const restaurantId = searchParams.get("restaurantId")?.trim() || DEFAULT_RESTAURANT_ID || null;

  if (!Number.isFinite(tableNumber) || tableNumber <= 0) {
    return NextResponse.json({ error: "Numéro de table invalide." }, { status: 400 });
  }

  const tableResolution = await resolveActiveTableByNumber<{
    id: string;
    numero: number;
    restaurant_id: string;
  }>({
    supabase,
    tableNumber,
    restaurantId,
    select: "id, numero, restaurant_id",
  });

  if (tableResolution.error) {
    return NextResponse.json({ error: tableResolution.error }, { status: 500 });
  }

  const table = tableResolution.table;
  if (!table) {
    return NextResponse.json({ error: "Table introuvable." }, { status: 404 });
  }

  // IMPORTANT confidentialité : on ne renvoie QUE les commandes de CE client
  // (les IDs stockés localement sur son téléphone lors de la commande), jamais
  // toutes les commandes de la table. Sans ça, chaque client voyait les
  // commandes des autres.
  let activeOrders: unknown[] = [];
  let historyOrders: unknown[] = [];

  if (historyIds.length > 0) {
    const ordersResult = await supabase
      .from("orders")
      .select("id, statut, heure, total, eta_minutes, rating:ratings(id, note, commentaire)")
      .eq("table_id", table.id)
      .in("id", historyIds)
      .order("heure", { ascending: false });

    if (ordersResult.error) {
      return NextResponse.json({ error: ordersResult.error.message }, { status: 500 });
    }

    const rows = (ordersResult.data ?? []) as unknown as HistoryOrderRaw[];
    const mapped = rows.map((order) => {
      const ratingRelation = Array.isArray(order.rating) ? order.rating[0] : order.rating;
      return {
        id: order.id,
        statut: order.statut,
        heure: order.heure,
        total: order.total,
        eta_minutes: order.eta_minutes,
        has_rating: Boolean(ratingRelation?.id),
        rating_note: ratingRelation?.note ?? null,
        rating_commentaire: ratingRelation?.commentaire ?? null,
      };
    });

    activeOrders = mapped.filter(
      (order) => order.statut === "received" || order.statut === "preparing",
    );
    historyOrders = mapped;
  }

  return NextResponse.json(
    {
      table: {
        id: table.id,
        numero: table.numero,
      },
      activeOrders,
      historyOrders,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
