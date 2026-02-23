"use client";

import { useCallback, useEffect, useState } from "react";

import { loadCatalog, type MenuCatalog } from "@/lib/data/menu";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export function useCatalog(restaurantId?: string) {
  const [catalog, setCatalog] = useState<MenuCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = getBrowserSupabase();
      const nextCatalog = await loadCatalog({
        supabase,
        restaurantId,
        allowFallback: false,
      });
      setCatalog(nextCatalog);
      setError(null);
    } catch (loadError) {
      setCatalog(null);
      setError(loadError instanceof Error ? loadError.message : "CATALOG_LOAD_FAILED");
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      return;
    }

    const channel = supabase
      .channel("menu-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "items" },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "promotions" },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "service_hours" },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  return {
    catalog,
    loading,
    error,
    refresh,
  };
}
