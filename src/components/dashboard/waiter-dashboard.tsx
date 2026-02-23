"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/common/button";
import { Badge, Card, CardTitle } from "@/components/common/card";
import { PageShell } from "@/components/layout/page-shell";
import { formatDateTime, orderStatusLabel, serverCallReasonLabel } from "@/lib/helpers/format";
import { playNotificationTone } from "@/lib/helpers/sound";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { DEFAULT_RESTAURANT_ID } from "@/lib/supabase/env";
import { useI18n } from "@/providers/i18n-provider";
import { useNotifications } from "@/providers/notifications-provider";
import type { ServerCallStatus } from "@/types/domain";

interface ServerCallView {
  id: string;
  motif: "addition" | "aide" | "demande_speciale";
  details: string | null;
  statut: ServerCallStatus;
  heure: string;
  table: { numero: number } | null;
}

interface OrderView {
  id: string;
  statut: "received" | "preparing" | "ready";
  heure: string;
  table: { numero: number } | null;
}

export function WaiterDashboard() {
  const { locale, messages } = useI18n();
  const { notifyError, notifyInfo, notifySuccess } = useNotifications();

  const [calls, setCalls] = useState<ServerCallView[]>([]);
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [readyOrders, setReadyOrders] = useState<OrderView[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [callsResult, ordersResult, readyResult] = await Promise.all([
      supabase
        .from("server_calls")
        .select("id, motif, details, statut, heure, table:tables(numero)")
        .eq("restaurant_id", DEFAULT_RESTAURANT_ID)
        .in("statut", ["pending", "acknowledged"])
        .order("heure", { ascending: false }),
      supabase
        .from("orders")
        .select("id, statut, heure, table:tables(numero)")
        .eq("restaurant_id", DEFAULT_RESTAURANT_ID)
        .in("statut", ["received", "preparing"])
        .gte("heure", todayStart.toISOString())
        .order("heure", { ascending: false }),
      supabase
        .from("orders")
        .select("id, statut, heure, table:tables(numero)")
        .eq("restaurant_id", DEFAULT_RESTAURANT_ID)
        .eq("statut", "ready")
        .gte("heure", todayStart.toISOString())
        .order("heure", { ascending: false }),
    ]);

    type RawCall = Omit<ServerCallView, "table"> & {
      table: ServerCallView["table"] | Array<NonNullable<ServerCallView["table"]>>;
    };
    type RawOrder = Omit<OrderView, "table"> & {
      table: OrderView["table"] | Array<NonNullable<OrderView["table"]>>;
    };

    const normalizedCalls = ((callsResult.data ?? []) as unknown as RawCall[]).map((call) => ({
      ...call,
      table: Array.isArray(call.table) ? (call.table[0] ?? null) : call.table,
    }));
    const normalizedOrders = ((ordersResult.data ?? []) as unknown as RawOrder[]).map((order) => ({
      ...order,
      table: Array.isArray(order.table) ? (order.table[0] ?? null) : order.table,
    }));
    const normalizedReadyOrders = ((readyResult.data ?? []) as unknown as RawOrder[]).map((order) => ({
      ...order,
      table: Array.isArray(order.table) ? (order.table[0] ?? null) : order.table,
    }));

    setCalls(normalizedCalls);
    setOrders(normalizedOrders);
    setReadyOrders(normalizedReadyOrders);
    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      return;
    }

    const channel = supabase
      .channel("waiter-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "server_calls" },
        (payload: { new: { motif: "addition" | "aide" | "demande_speciale" } }) => {
          playNotificationTone("server_call");
          notifyInfo(
            locale === "fr" ? "Nouvel appel client" : "New table call",
            serverCallReasonLabel(payload.new.motif, locale),
          );
          void loadData();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "server_calls" },
        () => void loadData(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload: { new: { statut?: string } }) => {
          if (payload.new.statut === "ready") {
            playNotificationTone("order_ready");
            notifyInfo(locale === "fr" ? "Commande prête" : "Order ready");
          }
          void loadData();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [locale, notifyInfo]);

  async function updateCallStatus(callId: string, status: ServerCallStatus) {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      return;
    }

    const { error } = await supabase
      .from("server_calls")
      .update({ statut: status })
      .eq("id", callId)
      .eq("restaurant_id", DEFAULT_RESTAURANT_ID);
    if (error) {
      notifyError(locale === "fr" ? "Mise à jour impossible" : "Update failed", error.message);
      return;
    }
    notifySuccess(
      locale === "fr" ? "Appel mis à jour" : "Call updated",
      status === "closed"
        ? locale === "fr"
          ? "Appel clôturé"
          : "Call closed"
        : locale === "fr"
          ? "Appel acquitté"
          : "Call acknowledged",
    );
    void loadData();
  }

  const activeTableCount = useMemo(
    () => new Set([...orders, ...readyOrders].map((order) => order.table?.numero).filter(Boolean)).size,
    [orders, readyOrders],
  );

  return (
    <PageShell title={messages.waiter.title} subtitle="Alertes clients et commandes prêtes synchronisées en direct.">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <CardTitle className="font-heading text-3xl">{messages.waiter.incomingCalls}</CardTitle>
            <Badge>{calls.length}</Badge>
          </div>

          {loading ? (
            <p className="mt-3 text-sm">{messages.common.loading}</p>
          ) : calls.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-black)]/65">{messages.waiter.noCalls}</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {calls.map((call) => (
                <li key={call.id} className="rounded-xl border border-[var(--color-light-gray)] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--color-dark-green)]">
                        Table {call.table?.numero ?? "-"} · {serverCallReasonLabel(call.motif, locale)}
                      </p>
                      <p className="text-xs text-[var(--color-black)]/65">{formatDateTime(call.heure, locale)}</p>
                      {call.details ? <p className="mt-1 text-xs text-[var(--color-black)]/70">{call.details}</p> : null}
                    </div>
                    <Badge>{call.statut}</Badge>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void updateCallStatus(call.id, "acknowledged")}
                      disabled={call.statut !== "pending"}
                    >
                      {messages.waiter.acknowledge}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void updateCallStatus(call.id, "closed")}
                      disabled={call.statut === "closed"}
                    >
                      {messages.waiter.closeCall}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardTitle className="font-heading text-3xl">{messages.waiter.readyOrders}</CardTitle>
            {readyOrders.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--color-black)]/65">{messages.common.noData}</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {readyOrders.map((order) => (
                  <li key={order.id} className="rounded-xl border border-[var(--color-light-gray)] p-2 text-sm">
                    Commande #{order.id.slice(0, 8)} · Table {order.table?.numero ?? "-"}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardTitle className="font-heading text-3xl">{messages.waiter.activeTables}</CardTitle>
            <p className="mt-2 text-3xl font-extrabold text-[var(--color-dark-green)]">{activeTableCount}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {orders.map((order) => (
                <li key={order.id} className="rounded-xl border border-[var(--color-light-gray)] p-2">
                  Table {order.table?.numero ?? "-"} · {orderStatusLabel(order.statut, locale)}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
