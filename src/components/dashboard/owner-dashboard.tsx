"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/common/button";
import { Card, CardTitle, StatCard } from "@/components/common/card";
import { PageShell } from "@/components/layout/page-shell";
import { formatCurrency } from "@/lib/helpers/format";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { DEFAULT_RESTAURANT_ID } from "@/lib/supabase/env";
import { useI18n } from "@/providers/i18n-provider";
import { useNotifications } from "@/providers/notifications-provider";

interface OrderStatRow {
  id: string;
  heure: string;
  total: number;
  table_id: string;
  table: { numero: number } | null;
  order_items: Array<{ quantite: number; item: { nom: string } | null }>;
  rating: { note: number; commentaire: string | null } | null;
}

interface RatingRow {
  note: number;
  commentaire: string | null;
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function OwnerDashboard() {
  const { locale, messages } = useI18n();
  const { notifyError, notifySuccess } = useNotifications();

  const [orders, setOrders] = useState<OrderStatRow[]>([]);
  const [ratings, setRatings] = useState<RatingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  async function loadData() {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [ordersResult, ratingsResult] = await Promise.all([
      supabase
        .from("orders")
        .select(
          "id, heure, total, table_id, table:tables(numero), order_items(quantite, item:items(nom)), rating:ratings(note, commentaire)",
        )
        .eq("restaurant_id", DEFAULT_RESTAURANT_ID)
        .gte("heure", monthStart.toISOString())
        .order("heure", { ascending: false }),
      Promise.resolve({ data: [] as RatingRow[] }),
    ]);

    type RawOrder = Omit<OrderStatRow, "table" | "order_items" | "rating"> & {
      table: OrderStatRow["table"] | Array<NonNullable<OrderStatRow["table"]>>;
      order_items: Array<{
        quantite: number;
        item: { nom: string } | Array<{ nom: string }> | null;
      }>;
      rating: OrderStatRow["rating"] | Array<NonNullable<OrderStatRow["rating"]>>;
    };

    const normalizedOrders = ((ordersResult.data ?? []) as unknown as RawOrder[]).map((order) => ({
      ...order,
      table: Array.isArray(order.table) ? (order.table[0] ?? null) : order.table,
      order_items: order.order_items.map((line) => ({
        ...line,
        item: Array.isArray(line.item) ? (line.item[0] ?? null) : line.item,
      })),
      rating: Array.isArray(order.rating) ? (order.rating[0] ?? null) : order.rating,
    }));

    setOrders(normalizedOrders);
    const scopedRatings = normalizedOrders
      .map((order) => order.rating)
      .filter((rating): rating is RatingRow => Boolean(rating));
    setRatings(scopedRatings.length > 0 ? scopedRatings : ((ratingsResult.data ?? []) as RatingRow[]));
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
      .channel("owner-dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => void loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "ratings" }, () => void loadData())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const metrics = useMemo(() => {
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);

    const weekStart = startOfWeek(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const dayOrders = orders.filter((order) => new Date(order.heure) >= dayStart);
    const weekOrders = orders.filter((order) => new Date(order.heure) >= weekStart);
    const monthOrders = orders.filter((order) => new Date(order.heure) >= monthStart);

    const sum = (list: OrderStatRow[]) => list.reduce((total, order) => total + order.total, 0);

    const itemCounter = new Map<string, number>();
    const tableCounter = new Map<number, number>();

    orders.forEach((order) => {
      if (order.table?.numero) {
        tableCounter.set(order.table.numero, (tableCounter.get(order.table.numero) ?? 0) + 1);
      }

      order.order_items.forEach((line) => {
        const itemName = line.item?.nom;
        if (!itemName) {
          return;
        }
        itemCounter.set(itemName, (itemCounter.get(itemName) ?? 0) + line.quantite);
      });
    });

    const topItems = [...itemCounter.entries()].sort((left, right) => right[1] - left[1]).slice(0, 5);
    const topTable = [...tableCounter.entries()].sort((left, right) => right[1] - left[1])[0];

    const avgTicket = orders.length > 0 ? sum(orders) / orders.length : 0;
    const avgRating = ratings.length > 0 ? ratings.reduce((acc, rating) => acc + rating.note, 0) / ratings.length : 0;

    return {
      revenueDay: sum(dayOrders),
      revenueWeek: sum(weekOrders),
      revenueMonth: sum(monthOrders),
      ordersDay: dayOrders.length,
      ordersWeek: weekOrders.length,
      ordersMonth: monthOrders.length,
      avgTicket,
      avgRating,
      topItems,
      topTable,
    };
  }, [orders, ratings]);

  async function sendDailyReportNow() {
    setSending(true);
    try {
      const response = await fetch("/api/reports/daily?manual=true", { method: "POST" });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        notifyError("Rapport non envoyé", payload.error ?? "Erreur serveur");
        setSending(false);
        return;
      }
      notifySuccess("Rapport journalier envoyé");
    } catch (error) {
      notifyError("Rapport non envoyé", error instanceof Error ? error.message : "Erreur réseau");
    } finally {
      setSending(false);
    }
  }

  return (
    <PageShell title={messages.owner.dashboard} subtitle="Pilotage global des performances de L'Adresse Dakar.">
      {loading ? (
        <Card>{messages.common.loading}</Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <StatCard
              label={`${messages.owner.revenue} (Jour)`}
              value={formatCurrency(metrics.revenueDay, locale)}
              hint={`${metrics.ordersDay} commandes`}
            />
            <StatCard
              label={`${messages.owner.revenue} (Semaine)`}
              value={formatCurrency(metrics.revenueWeek, locale)}
              hint={`${metrics.ordersWeek} commandes`}
            />
            <StatCard
              label={`${messages.owner.revenue} (Mois)`}
              value={formatCurrency(metrics.revenueMonth, locale)}
              hint={`${metrics.ordersMonth} commandes`}
            />
            <StatCard label={messages.owner.avgTicket} value={formatCurrency(metrics.avgTicket, locale)} />
            <StatCard label={messages.owner.ratings} value={metrics.avgRating.toFixed(2)} hint={`/5 · ${ratings.length} avis`} />
            <StatCard
              label={messages.owner.topTable}
              value={metrics.topTable ? `Table ${metrics.topTable[0]}` : "-"}
              hint={metrics.topTable ? `${metrics.topTable[1]} commandes` : "Aucune donnée"}
            />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
            <Card>
              <CardTitle className="font-heading text-3xl">{messages.owner.bestSellers}</CardTitle>
              {metrics.topItems.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--color-black)]/65">{messages.common.noData}</p>
              ) : (
                <ol className="mt-4 space-y-2">
                  {metrics.topItems.map(([itemName, qty], index) => (
                    <li key={itemName} className="rounded-xl border border-[var(--color-light-gray)] p-2 text-sm">
                      {index + 1}. {itemName} · {qty} ventes
                    </li>
                  ))}
                </ol>
              )}
            </Card>

            <Card>
              <CardTitle className="font-heading text-3xl">Modules</CardTitle>
              <div className="mt-4 space-y-2">
                <Link href="/admin" className="block">
                  <Button variant="secondary" className="w-full justify-start">
                    Administration
                  </Button>
                </Link>
                <Link href="/admin/tables" className="block">
                  <Button variant="secondary" className="w-full justify-start">
                    {messages.admin.tableManagement}
                  </Button>
                </Link>
                <Link href="/admin/promotions" className="block">
                  <Button variant="secondary" className="w-full justify-start">
                    {messages.admin.promotionManagement}
                  </Button>
                </Link>
                <Link href="/proprio/rapports" className="block">
                  <Button variant="secondary" className="w-full justify-start">
                    {messages.nav.reports}
                  </Button>
                </Link>
                <Button type="button" onClick={sendDailyReportNow} disabled={sending} className="w-full">
                  {sending ? messages.common.loading : messages.owner.sendNow}
                </Button>
              </div>
            </Card>
          </div>
        </>
      )}
    </PageShell>
  );
}
