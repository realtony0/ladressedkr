/* eslint-disable @typescript-eslint/no-explicit-any */

type TableScope = "scoped" | "fallback" | "none";

interface ResolveTableParams {
  supabase: any;
  tableNumber: number;
  restaurantId?: string | null;
  select?: string;
}

interface ResolveTableByAccessParams extends ResolveTableParams {
  accessToken: string;
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

export async function resolveActiveTableByAccessToken<T = { id: string; restaurant_id: string }>({
  supabase,
  tableNumber,
  accessToken,
  restaurantId,
  select = "*",
}: ResolveTableByAccessParams): Promise<ResolveTableResult<T>> {
  if (!supabase) {
    return { table: null, error: "Supabase client unavailable.", scope: "none" };
  }

  const parsedNumber = Number(tableNumber);
  if (!Number.isFinite(parsedNumber) || parsedNumber <= 0) {
    return { table: null, error: "Invalid table number.", scope: "none" };
  }

  const normalizedToken = accessToken.trim();
  if (!normalizedToken) {
    return { table: null, error: "Missing table access token.", scope: "none" };
  }
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(normalizedToken)) {
    return { table: null, error: "Invalid table access token.", scope: "none" };
  }

  const scopedRestaurantId = restaurantId?.trim() || null;

  let query = supabase
    .from("tables")
    .select(select)
    .eq("numero", parsedNumber)
    .eq("statut", "active")
    .eq("access_token", normalizedToken)
    .order("created_at", { ascending: false })
    .limit(1);

  if (scopedRestaurantId) {
    query = query.eq("restaurant_id", scopedRestaurantId);
  }

  let result = await query;
  if (result.error && result.error.message.toLowerCase().includes("access_token")) {
    let legacyQuery = supabase
      .from("tables")
      .select(select)
      .eq("numero", parsedNumber)
      .eq("statut", "active")
      .ilike("qr_code", `%access=${normalizedToken}%`)
      .order("created_at", { ascending: false })
      .limit(1);

    if (scopedRestaurantId) {
      legacyQuery = legacyQuery.eq("restaurant_id", scopedRestaurantId);
    }

    result = await legacyQuery;
  }

  if (result.error) {
    return { table: null, error: result.error.message, scope: scopedRestaurantId ? "scoped" : "none" };
  }

  const table = ((result.data ?? []) as T[])[0] ?? null;
  return {
    table,
    error: null,
    scope: scopedRestaurantId ? "scoped" : "none",
  };
}
