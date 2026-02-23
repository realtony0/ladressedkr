import { NextResponse } from "next/server";

import { resolveActiveTableByNumber } from "@/lib/data/tables";
import { DEFAULT_RESTAURANT_ID } from "@/lib/supabase/env";
import { getServiceSupabase } from "@/lib/supabase/server";
import type { ServerCallReason } from "@/types/domain";

interface CreateServerCallBody {
  tableNumber: number;
  motif: ServerCallReason;
  details?: string;
  restaurantId?: string;
}

export async function POST(request: Request) {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 });
  }

  const body = (await request.json()) as CreateServerCallBody;

  if (!Number.isFinite(body.tableNumber) || body.tableNumber <= 0) {
    return NextResponse.json({ error: "Numéro de table invalide" }, { status: 400 });
  }

  if (!["addition", "aide", "demande_speciale"].includes(body.motif)) {
    return NextResponse.json({ error: "Motif invalide" }, { status: 400 });
  }

  const resolvedRestaurantId = body.restaurantId?.trim() || DEFAULT_RESTAURANT_ID || null;
  const tableResolution = await resolveActiveTableByNumber<{ id: string; restaurant_id: string }>({
    supabase,
    tableNumber: body.tableNumber,
    restaurantId: resolvedRestaurantId,
    select: "id, restaurant_id",
  });

  if (tableResolution.error) {
    return NextResponse.json({ error: tableResolution.error }, { status: 500 });
  }

  const table = tableResolution.table;
  if (!table) {
    return NextResponse.json({ error: "Table inactive ou introuvable" }, { status: 404 });
  }

  const { error } = await supabase.from("server_calls").insert({
    table_id: table.id,
    restaurant_id: table.restaurant_id,
    motif: body.motif,
    details: body.details?.trim() || null,
    statut: "pending",
    heure: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
