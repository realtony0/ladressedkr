import { NextResponse } from "next/server";

import { requireStaffApiContext } from "@/lib/helpers/api-auth";
import { getServiceSupabase } from "@/lib/supabase/server";

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
  const body = (await request.json()) as { disponible: boolean };

  if (typeof body.disponible !== "boolean") {
    return NextResponse.json({ error: "Valeur de disponibilité invalide" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("items")
    .update({
      disponible: body.disponible,
    })
    .eq("id", id)
    .eq("restaurant_id", context.restaurantId)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Plat introuvable" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
