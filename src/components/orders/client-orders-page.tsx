"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/common/button";
import { Badge, Card, CardTitle } from "@/components/common/card";
import { PageShell } from "@/components/layout/page-shell";
import { ClientFlowNav } from "@/components/orders/client-flow-nav";
import { DEFAULT_RESTAURANT_ID } from "@/lib/supabase/env";
import { formatCurrency, formatDateTime, orderStatusLabel } from "@/lib/helpers/format";
import { getOrderHistory } from "@/lib/helpers/session-history";
import { useI18n } from "@/providers/i18n-provider";
import { useTableAccess } from "@/providers/table-access-provider";

interface TableView {
  id: string;
  numero: number;
}

interface OrderView {
  id: string;
  statut: "received" | "preparing" | "ready";
  heure: string;
  total: number;
  eta_minutes: number | null;
}

interface OrdersPayload {
  table?: TableView;
  activeOrders?: OrderView[];
  historyOrders?: OrderView[];
  error?: string;
}

export function ClientOrdersPage({ tableId }: { tableId: string }) {
  const { locale, messages } = useI18n();
  const { isReady: tableAccessReady, accessToken } = useTableAccess();

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
    if (!tableAccessReady) {
      return;
    }

    setLoading(true);
    setError(null);

    if (!accessToken) {
      setTable(null);
      setActiveOrders([]);
      setHistoryOrders([]);
      setError(
        locale === "fr"
          ? "Session QR invalide. Rescanne le QR de ta table."
          : "Invalid QR session. Please rescan your table QR.",
      );
      setLoading(false);
      return;
    }

    const params = new URLSearchParams();
    params.set("tableNumber", tableId);
    params.set("accessToken", accessToken);
    if (DEFAULT_RESTAURANT_ID) {
      params.set("restaurantId", DEFAULT_RESTAURANT_ID);
    }
    if (historyIds.length > 0) {
      params.set("historyIds", historyIds.join(","));
    }

    try {
      const response = await fetch(`/api/client/orders?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as OrdersPayload;

      if (!response.ok) {
        setTable(null);
        setActiveOrders([]);
        setHistoryOrders([]);
        setError(payload.error ?? (locale === "fr" ? "Impossible de charger les commandes." : "Unable to load orders."));
        setLoading(false);
        return;
      }

      setTable(payload.table ?? null);
      setActiveOrders(payload.activeOrders ?? []);
      setHistoryOrders(payload.historyOrders ?? []);
      setLoading(false);
    } catch (requestError) {
      setTable(null);
      setActiveOrders([]);
      setHistoryOrders([]);
      setError(
        requestError instanceof Error
          ? requestError.message
          : locale === "fr"
            ? "Impossible de charger les commandes."
            : "Unable to load orders.",
      );
      setLoading(false);
    }
  }, [accessToken, historyIds, locale, tableAccessReady, tableId]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders, refreshTick]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    const interval = window.setInterval(() => {
      setRefreshTick((value) => value + 1);
    }, 6000);

    return () => {
      window.clearInterval(interval);
    };
  }, [accessToken]);

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
                          <p className="text-sm font-bold text-[var(--color-dark-green)]">
                            {formatCurrency(order.total, locale)}
                          </p>
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
                          <p className="text-sm font-bold text-[var(--color-dark-green)]">
                            {formatCurrency(order.total, locale)}
                          </p>
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

