import { NextResponse } from "next/server";

import { requireStaffApiContext } from "@/lib/helpers/api-auth";
import { getServiceSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const context = await requireStaffApiContext(["admin", "proprio"]);
  if (context instanceof NextResponse) {
    return context;
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json({ error: "Paramètres from/to requis" }, { status: 400 });
  }

  const fromIso = `${from}T00:00:00.000Z`;
  const toIso = `${to}T23:59:59.999Z`;

  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, heure, statut, total, table:tables(numero), ratings(note, commentaire)")
    .eq("restaurant_id", context.restaurantId)
    .gte("heure", fromIso)
    .lte("heure", toIso)
    .order("heure", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type OrderRowRaw = {
    id: string;
    heure: string;
    statut: string;
    total: number;
    table: { numero: number } | Array<{ numero: number }> | null;
    ratings: Array<{ note: number; commentaire: string | null }> | null;
  };

  const typedOrders = (orders ?? []) as unknown as OrderRowRaw[];

  const rows = [
    ["id", "date", "table", "status", "total_fcfa", "rating", "comment"],
    ...typedOrders.map((order) => {
      const tableRelation = Array.isArray(order.table) ? order.table[0] : order.table;
      const rating = order.ratings?.[0];
      return [
        order.id,
        order.heure,
        String(tableRelation?.numero ?? ""),
        order.statut,
        String(order.total),
        rating ? String(rating.note) : "",
        rating?.commentaire?.replace(/\n/g, " ") ?? "",
      ];
    }),
  ];

  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ladresse-report-${from}-${to}.csv"`,
    },
  });
}
