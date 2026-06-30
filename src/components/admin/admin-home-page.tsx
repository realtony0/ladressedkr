"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BarChart3,
  BellRing,
  CalendarCheck,
  Clock3,
  ImagePlus,
  QrCode,
  Tag,
  UsersRound,
  UtensilsCrossed,
} from "lucide-react";

import { StatCard } from "@/components/common/card";
import { PageShell } from "@/components/layout/page-shell";
import { formatCurrency } from "@/lib/helpers/format";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { DEFAULT_RESTAURANT_ID } from "@/lib/supabase/env";

const TILES = [
  {
    href: "/cuisine",
    label: "Commandes en direct",
    description: "Les commandes des clients qui arrivent, en temps réel.",
    icon: BellRing,
    accent: true,
    statKey: "activeOrders" as const,
  },
  {
    href: "/admin/reservations",
    label: "Réservations",
    description: "Les demandes de réservation faites en ligne.",
    icon: CalendarCheck,
    statKey: "pendingReservations" as const,
  },
  {
    href: "/admin/menu",
    label: "Le menu",
    description: "Ajouter ou modifier les plats, prix et photos.",
    icon: UtensilsCrossed,
  },
  {
    href: "/admin/tables",
    label: "Tables & QR codes",
    description: "Gérer les tables et imprimer les QR codes.",
    icon: QrCode,
  },
  {
    href: "/admin/promotions",
    label: "Promotions",
    description: "Créer des réductions sur certains plats.",
    icon: Tag,
  },
  {
    href: "/admin/horaires",
    label: "Horaires",
    description: "Définir les heures de service et de brunch.",
    icon: Clock3,
  },
  {
    href: "/admin/personnel",
    label: "Personnel",
    description: "Gérer l'équipe et le planning.",
    icon: UsersRound,
  },
  {
    href: "/proprio/rapports",
    label: "Rapports & chiffre d'affaires",
    description: "Voir les ventes et exporter les rapports.",
    icon: BarChart3,
  },
  {
    href: "/admin/photos",
    label: "Photos des plats",
    description: "Uploader toutes les photos en une seule fois.",
    icon: ImagePlus,
  },
];

interface DashboardStats {
  revenueToday: number;
  ordersToday: number;
  activeOrders: number;
  pendingReservations: number;
}

const EMPTY_STATS: DashboardStats = {
  revenueToday: 0,
  ordersToday: 0,
  activeOrders: 0,
  pendingReservations: 0,
};

export function AdminHomePage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setStats(EMPTY_STATS);
      return;
    }

    let cancelled = false;

    async function loadStats() {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [ordersResult, activeResult, reservationsResult] = await Promise.all([
        supabase!
          .from("orders")
          .select("total")
          .eq("restaurant_id", DEFAULT_RESTAURANT_ID)
          .gte("heure", todayStart.toISOString()),
        supabase!
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("restaurant_id", DEFAULT_RESTAURANT_ID)
          .in("statut", ["received", "preparing"]),
        supabase!
          .from("reservations")
          .select("id", { count: "exact", head: true })
          .eq("restaurant_id", DEFAULT_RESTAURANT_ID)
          .eq("statut", "pending"),
      ]);

      if (cancelled) return;

      const todayOrders = (ordersResult.data ?? []) as Array<{ total: number }>;
      setStats({
        revenueToday: todayOrders.reduce((sum, order) => sum + order.total, 0),
        ordersToday: todayOrders.length,
        activeOrders: activeResult.count ?? 0,
        pendingReservations: reservationsResult.count ?? 0,
      });
    }

    void loadStats();

    const channel = supabase
      .channel("admin-home-stats")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => void loadStats())
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => void loadStats())
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, []);

  return (
    <PageShell
      title="Tableau de bord"
      subtitle="Tout votre restaurant au même endroit. Choisissez ce que vous voulez gérer."
    >
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Chiffre d'affaires aujourd'hui"
          value={stats ? formatCurrency(stats.revenueToday, "fr") : "—"}
          hint={stats ? `${stats.ordersToday} commande${stats.ordersToday > 1 ? "s" : ""}` : undefined}
        />
        <StatCard
          label="Commandes en cours"
          value={stats ? String(stats.activeOrders) : "—"}
          hint="En attente ou en préparation"
        />
        <StatCard
          label="Réservations en attente"
          value={stats ? String(stats.pendingReservations) : "—"}
          hint="À confirmer ou refuser"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((tile) => {
          const Icon = tile.icon;
          const liveCount = tile.statKey && stats ? stats[tile.statKey] : 0;
          return (
            <Link
              key={tile.href}
              href={tile.href}
              className={`group relative flex flex-col rounded-2xl border p-5 transition-all hover:-translate-y-1 hover:shadow-lg ${
                tile.accent
                  ? "border-[var(--color-dark-green)] bg-[var(--color-dark-green)] text-white"
                  : "border-[var(--color-light-gray)] bg-white text-[var(--color-dark-green)]"
              }`}
            >
              {liveCount > 0 ? (
                <span
                  className={`absolute right-4 top-4 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold ${
                    tile.accent ? "bg-white text-[var(--color-dark-green)]" : "bg-[var(--color-gold)] text-white"
                  }`}
                >
                  {liveCount}
                </span>
              ) : null}
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                  tile.accent ? "bg-white/15" : "bg-[#eef4ee]"
                }`}
              >
                <Icon className="h-6 w-6" />
              </span>
              <span className="mt-4 text-lg font-bold">{tile.label}</span>
              <span
                className={`mt-1 text-sm ${
                  tile.accent ? "text-white/85" : "text-[var(--color-black)]/65"
                }`}
              >
                {tile.description}
              </span>
              <span className="mt-4 text-sm font-semibold">
                Ouvrir →
              </span>
            </Link>
          );
        })}
      </div>
    </PageShell>
  );
}
