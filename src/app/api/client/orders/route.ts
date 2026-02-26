import { NextResponse } from "next/server";

import { resolveActiveTableByAccessToken } from "@/lib/data/tables";
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

export async function GET(request: Request) {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const tableNumber = Number(searchParams.get("tableNumber"));
  const accessToken = searchParams.get("accessToken")?.trim() ?? "";
  const historyIds = parseHistoryIds(searchParams.get("historyIds"));
  const restaurantId = searchParams.get("restaurantId")?.trim() || DEFAULT_RESTAURANT_ID || null;

  if (!Number.isFinite(tableNumber) || tableNumber <= 0 || !accessToken) {
    return NextResponse.json({ error: "Paramètres table/access invalides." }, { status: 400 });
  }

  const tableResolution = await resolveActiveTableByAccessToken<{
    id: string;
    numero: number;
    restaurant_id: string;
  }>({
    supabase,
    tableNumber,
    accessToken,
    restaurantId,
    select: "id, numero, restaurant_id",
  });

  if (tableResolution.error) {
    return NextResponse.json({ error: tableResolution.error }, { status: 500 });
  }

  const table = tableResolution.table;
  if (!table) {
    return NextResponse.json({ error: "Session QR invalide ou expirée." }, { status: 403 });
  }

  const activeResult = await supabase
    .from("orders")
    .select("id, statut, heure, total, eta_minutes")
    .eq("table_id", table.id)
    .in("statut", ["received", "preparing"])
    .order("heure", { ascending: false })
    .limit(25);

  if (activeResult.error) {
    return NextResponse.json({ error: activeResult.error.message }, { status: 500 });
  }

  let historyOrders: unknown[] = [];

  if (historyIds.length > 0) {
    const historyResult = await supabase
      .from("orders")
      .select("id, statut, heure, total, eta_minutes")
      .eq("table_id", table.id)
      .in("id", historyIds)
      .order("heure", { ascending: false });

    if (historyResult.error) {
      return NextResponse.json({ error: historyResult.error.message }, { status: 500 });
    }

    historyOrders = historyResult.data ?? [];
  }

  return NextResponse.json(
    {
      table: {
        id: table.id,
        numero: table.numero,
      },
      activeOrders: activeResult.data ?? [],
      historyOrders,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

