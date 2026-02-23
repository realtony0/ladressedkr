/* eslint-disable @typescript-eslint/no-explicit-any */

type TableScope = "scoped" | "fallback" | "none";

interface ResolveTableParams {
  supabase: any;
  tableNumber: number;
  restaurantId?: string | null;
  select?: string;
}

interface ResolveTableResult<T> {
  table: T | null;
  error: string | null;
  scope: TableScope;
}

async function queryActiveTable({
  supabase,
  tableNumber,
  restaurantId,
  select,
}: {
  supabase: any;
  tableNumber: number;
  restaurantId?: string | null;
  select: string;
}) {
  let query = supabase
    .from("tables")
    .select(select)
    .eq("numero", tableNumber)
    .eq("statut", "active")
    .order("created_at", { ascending: false })
    .limit(1);

  if (restaurantId) {
    query = query.eq("restaurant_id", restaurantId);
  }

  return query;
}

export async function resolveActiveTableByNumber<T = { id: string; restaurant_id: string }>({
  supabase,
  tableNumber,
  restaurantId,
  select = "*",
}: ResolveTableParams): Promise<ResolveTableResult<T>> {
  if (!supabase) {
    return { table: null, error: "Supabase client unavailable.", scope: "none" };
  }

  const parsedNumber = Number(tableNumber);
  if (!Number.isFinite(parsedNumber) || parsedNumber <= 0) {
    return { table: null, error: "Invalid table number.", scope: "none" };
  }

  const scopedRestaurantId = restaurantId?.trim() || null;

  if (scopedRestaurantId) {
    const scopedResult = await queryActiveTable({
      supabase,
      tableNumber: parsedNumber,
      restaurantId: scopedRestaurantId,
      select,
    });

    if (scopedResult.error) {
      return { table: null, error: scopedResult.error.message, scope: "scoped" };
    }

    const scopedTable = ((scopedResult.data ?? []) as T[])[0] ?? null;
    return { table: scopedTable, error: null, scope: "scoped" };
  }

  const fallbackResult = await queryActiveTable({
    supabase,
    tableNumber: parsedNumber,
    restaurantId: null,
    select,
  });

  if (fallbackResult.error) {
    return {
      table: null,
      error: fallbackResult.error.message,
      scope: scopedRestaurantId ? "fallback" : "none",
    };
  }

  const fallbackTable = ((fallbackResult.data ?? []) as T[])[0] ?? null;
  return {
    table: fallbackTable,
    error: null,
    scope: scopedRestaurantId ? "fallback" : "none",
  };
}
