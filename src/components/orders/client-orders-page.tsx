"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/common/button";
import { Badge, Card, CardTitle } from "@/components/common/card";
import { PageShell } from "@/components/layout/page-shell";
import { ClientFlowNav } from "@/components/orders/client-flow-nav";
import { resolveActiveTableByNumber } from "@/lib/data/tables";
import { formatCurrency, formatDateTime, orderStatusLabel } from "@/lib/helpers/format";
import { getOrderHistory } from "@/lib/helpers/session-history";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { DEFAULT_RESTAURANT_ID } from "@/lib/supabase/env";
import { useI18n } from "@/providers/i18n-provider";

interface TableView {
  id: string;
  numero: number;
}

interface OrderView {
  id: string;
  statut: "received" | "preparing" | "ready";
  heure: string;
  total: number;
}

export function ClientOrdersPage({ tableId }: { tableId: string }) {
  const { locale, messages } = useI18n();
  const [table, setTable] = useState<TableView | null>(null);
  const [activeOrders, setActiveOrders] = useState<OrderView[]>([]);
  const [historyOrders, setHistoryOrders] = useState<OrderView[]>([]);
  const [historyIds, setHistoryIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    setHistoryIds(getOrderHistory(tableId));
  }, [tableId, refreshTick]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);

    const supabase = getBrowserSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }

    const tableNumber = Number(tableId);
    if (!Number.isFinite(tableNumber) || tableNumber <= 0) {
      setError("Numéro de table invalide.");
      setLoading(false);
      return;
    }

    const tableResolution = await resolveActiveTableByNumber<TableView>({
      supabase,
      tableNumber,
      restaurantId: DEFAULT_RESTAURANT_ID || undefined,
      select: "id, numero",
    });

    if (tableResolution.error) {
      setError(locale === "fr" ? "Impossible de récupérer la table." : "Unable to load table.");
      setLoading(false);
      return;
    }

    if (!tableResolution.table) {
      setError("Cette table est inactive ou ce QR n'est plus valide.");
      setLoading(false);
      return;
    }

    const resolvedTable = tableResolution.table;

    setTable(resolvedTable);

    const activeResult = await supabase
      .from("orders")
      .select("id, statut, heure, total")
      .eq("table_id", resolvedTable.id)
      .in("statut", ["received", "preparing"])
      .order("heure", { ascending: false })
      .limit(20);

    if (activeResult.error) {
      setError(locale === "fr" ? "Impossible de charger les commandes en cours." : "Unable to load active orders.");
      setLoading(false);
      return;
    }

    setActiveOrders((activeResult.data as OrderView[]) ?? []);

    if (historyIds.length > 0) {
      const historyResult = await supabase
        .from("orders")
        .select("id, statut, heure, total")
        .eq("table_id", resolvedTable.id)
        .in("id", historyIds)
        .order("heure", { ascending: false });

      if (historyResult.error) {
        setError(locale === "fr" ? "Impossible de charger l'historique." : "Unable to load order history.");
        setLoading(false);
        return;
      }

      setHistoryOrders((historyResult.data as OrderView[]) ?? []);
    } else {
      setHistoryOrders([]);
    }

    setLoading(false);
  }, [historyIds, locale, tableId]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (!table?.id) {
      return;
    }

    const supabase = getBrowserSupabase();
    if (!supabase) {
      return;
    }

    const channel = supabase
      .channel(`client-orders-live-${table.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `table_id=eq.${table.id}` }, () =>
        setRefreshTick((value) => value + 1),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [table?.id]);

  return (
    <PageShell
      title={messages.client.orderHistory}
      subtitle={`${messages.common.table} ${table?.numero ?? tableId} · ${messages.client.activeOrders}`}
      className="pb-28 lg:pb-8"
    >
      <ClientFlowNav tableId={tableId} />

      {loading ? (
        <Card>{messages.common.loading}</Card>
      ) : error ? (
        <Card>
          <p className="text-sm text-[#8b2424]">{error}</p>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-[var(--color-black)]/70">
                {messages.common.table} {table?.numero ?? tableId}
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href={`/${tableId}/appel`}>
                  <Button variant="secondary">{messages.client.callServer}</Button>
                </Link>
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => setRefreshTick((value) => value + 1)}
                >
                  <RefreshCw className="h-4 w-4" />
                  {messages.common.retry}
                </Button>
              </div>
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card className="min-w-0">
            <div className="mb-3 flex items-center justify-between gap-2">
              <CardTitle className="font-heading text-3xl">{messages.client.activeOrders}</CardTitle>
              <Badge className="shrink-0">{activeOrders.length}</Badge>
            </div>
            {activeOrders.length === 0 ? (
              <p className="text-sm text-[var(--color-black)]/65">{messages.client.noActiveOrders}</p>
            ) : (
              <ul className="space-y-2">
                {activeOrders.map((order) => (
                  <li key={order.id} className="rounded-xl border border-[var(--color-light-gray)] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[var(--color-dark-green)]">
                          #{order.id.slice(0, 8)} · {orderStatusLabel(order.statut, locale)}
                        </p>
                        <p className="text-xs text-[var(--color-black)]/65">{formatDateTime(order.heure, locale)}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold text-[var(--color-dark-green)]">{formatCurrency(order.total, locale)}</p>
                        <Link
                          href={`/commande/${order.id}?table=${tableId}`}
                          className="text-xs font-semibold text-[var(--color-dark-green)] underline-offset-2 hover:underline"
                        >
                          {messages.client.openOrder}
                        </Link>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="min-w-0">
            <div className="mb-3 flex items-center justify-between gap-2">
              <CardTitle className="font-heading text-3xl">{messages.client.orderHistory}</CardTitle>
              <Badge className="shrink-0">{historyOrders.length}</Badge>
            </div>
            {historyOrders.length === 0 ? (
              <p className="text-sm text-[var(--color-black)]/65">{messages.common.noData}</p>
            ) : (
              <ul className="space-y-2">
                {historyOrders.map((order) => (
                  <li key={order.id} className="rounded-xl border border-[var(--color-light-gray)] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[var(--color-dark-green)]">
                          #{order.id.slice(0, 8)} · {orderStatusLabel(order.statut, locale)}
                        </p>
                        <p className="text-xs text-[var(--color-black)]/65">{formatDateTime(order.heure, locale)}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold text-[var(--color-dark-green)]">{formatCurrency(order.total, locale)}</p>
                        <Link
                          href={`/commande/${order.id}?table=${tableId}`}
                          className="text-xs font-semibold text-[var(--color-dark-green)] underline-offset-2 hover:underline"
                        >
                          {messages.client.openOrder}
                        </Link>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          </div>
        </div>
      )}
    </PageShell>
  );
}
