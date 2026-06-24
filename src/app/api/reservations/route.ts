import { NextResponse } from "next/server";

import { requireStaffApiContext } from "@/lib/helpers/api-auth";
import { DEFAULT_RESTAURANT_ID } from "@/lib/supabase/env";
import { getServiceSupabase } from "@/lib/supabase/server";

interface CreateReservationBody {
  nom: string;
  telephone: string;
  email?: string;
  date: string;
  heure: string;
  nbPersonnes: number;
  message?: string;
  restaurantId?: string;
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^\d{2}:\d{2}$/;

export async function POST(request: Request) {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 });
  }

  const body = (await request.json()) as CreateReservationBody;

  const nom = body.nom?.trim();
  const telephone = body.telephone?.trim();
  const nbPersonnes = Math.floor(Number(body.nbPersonnes));

  if (!nom || !telephone) {
    return NextResponse.json({ error: "Nom et téléphone obligatoires." }, { status: 400 });
  }
  if (!DATE_REGEX.test(body.date) || !TIME_REGEX.test(body.heure)) {
    return NextResponse.json({ error: "Date ou heure invalide." }, { status: 400 });
  }
  if (!Number.isFinite(nbPersonnes) || nbPersonnes < 1 || nbPersonnes > 50) {
    return NextResponse.json({ error: "Nombre de personnes invalide." }, { status: 400 });
  }

  const restaurantId = body.restaurantId?.trim() || DEFAULT_RESTAURANT_ID || null;
  if (!restaurantId) {
    return NextResponse.json({ error: "Restaurant introuvable." }, { status: 400 });
  }

  const { error } = await supabase.from("reservations").insert({
    restaurant_id: restaurantId,
    nom,
    telephone,
    email: body.email?.trim() || null,
    date_reservation: body.date,
    heure: body.heure,
    nb_personnes: nbPersonnes,
    message: body.message?.trim() || null,
    statut: "pending",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const context = await requireStaffApiContext(["admin", "proprio", "serveur"]);
  if (context instanceof NextResponse) {
    return context;
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 });
  }

  const body = (await request.json()) as { id?: string; statut?: string };
  const allowed = ["pending", "confirmed", "declined", "cancelled"];
  if (!body.id || !body.statut || !allowed.includes(body.statut)) {
    return NextResponse.json({ error: "Paramètres invalides." }, { status: 400 });
  }

  const { error } = await supabase
    .from("reservations")
    .update({ statut: body.statut })
    .eq("id", body.id)
    .eq("restaurant_id", context.restaurantId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
