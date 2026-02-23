import { NextResponse } from "next/server";

import { getServiceSupabase } from "@/lib/supabase/server";

interface CreateRatingBody {
  orderId: string;
  note: number;
  commentaire?: string;
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

  const { data: order } = await supabase.from("orders").select("id, statut").eq("id", body.orderId).maybeSingle();

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
