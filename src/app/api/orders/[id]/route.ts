import { NextResponse } from "next/server";

import { ORDER_STATUS_FLOW } from "@/lib/helpers/constants";
import { requireStaffApiContext } from "@/lib/helpers/api-auth";
import { getServiceSupabase } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 });
  }

  const { id } = await params;

  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, statut, heure, total, eta_minutes, table:tables(numero), order_items(id, quantite, note, prix_unitaire, supplement, item:items(nom), accompaniment:accompaniments(nom), pizza_size:pizza_sizes(taille))",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await requireStaffApiContext(["cuisine", "admin", "proprio"]);
  if (context instanceof NextResponse) {
    return context;
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 });
  }

  const { id } = await params;
  const payload = (await request.json()) as {
    statut?: "received" | "preparing" | "ready";
    eta_minutes?: number | null;
  };

  if (payload.statut && !ORDER_STATUS_FLOW.includes(payload.statut)) {
    return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
  }

  const updatePayload: { statut?: string; eta_minutes?: number | null; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };

  if (payload.statut) {
    updatePayload.statut = payload.statut;
  }

  if (typeof payload.eta_minutes !== "undefined") {
    updatePayload.eta_minutes = payload.eta_minutes;
  }

  const { data, error } = await supabase
    .from("orders")
    .update(updatePayload)
    .eq("id", id)
    .eq("restaurant_id", context.restaurantId)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
