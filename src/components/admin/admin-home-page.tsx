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
import { ONLINE_ORDERING_ENABLED } from "@/lib/helpers/features";
import { formatCurrency } from "@/lib/helpers/format";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { DEFAULT_RESTAURANT_ID } from "@/lib/supabase/env";

// Ordre d'usage réel : ce qu'on touche tous les jours d'abord, les réglages
// rares ensuite. La commande en ligne étant en pause, son écran passe en fin
// de liste plutôt qu'en tête.
const TILES = [
  {
    href: "/admin/menu",
    label: "La carte",
    description: "Changer un prix, une photo, retirer ou ajouter un plat.",
    icon: UtensilsCrossed,
    accent: true,
  },
  {
    href: "/admin/reservations",
    label: "Réservations",
    description: "Les demandes de réservation faites en ligne.",
    icon: CalendarCheck,
    statKey: "pendingReservations" as const,
  },
  {
    href: "/admin/horaires",
    label: "Horaires",
    description: "Les heures de service et du brunch.",
    icon: Clock3,
  },
  {
    href: "/admin/promotions",
    label: "Promotions",
    description: "Créer des réductions sur certains plats.",
    icon: Tag,
  },
  {
    href: "/admin/tables",
    label: "Tables & QR codes",
    description: "Gérer les tables et réimprimer les QR codes.",
    icon: QrCode,
  },
  {
    href: "/admin/photos",
    label: "Envoi groupé de photos",
    description: "Pour envoyer beaucoup de photos d'un coup. Pour un seul plat, passez par La carte.",
    icon: ImagePlus,
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
    href: "/cuisine",
    label: "Commandes en direct",
    description: ONLINE_ORDERING_ENABLED
      ? "Les commandes des clients qui arrivent, en temps réel."
      : "En pause : les clients commandent auprès d'un serveur, pas depuis leur téléphone.",
    icon: BellRing,
    // Pas de compteur quand la fonction est en pause : il afficherait les
    // commandes restées ouvertes à l'arrêt du service, ce qui ferait croire
    // qu'il y a du travail en attente.
    statKey: ONLINE_ORDERING_ENABLED ? ("activeOrders" as const) : undefined,
    muted: !ONLINE_ORDERING_ENABLED,
  },
];

interface DashboardStats {
  revenueToday: number;
  ordersToday: number;
  activeOrders: number;
  pendingReservations: number;
  itemsOnMenu: number;
  itemsHidden: number;
}

const EMPTY_STATS: DashboardStats = {
  revenueToday: 0,
  ordersToday: 0,
  activeOrders: 0,
  pendingReservations: 0,
  itemsOnMenu: 0,
  itemsHidden: 0,
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

      const [ordersResult, activeResult, reservationsResult, onMenuResult, hiddenResult] = await Promise.all([
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
        supabase!
          .from("items")
          .select("id", { count: "exact", head: true })
          .eq("restaurant_id", DEFAULT_RESTAURANT_ID)
          .eq("disponible", true),
        supabase!
          .from("items")
          .select("id", { count: "exact", head: true })
          .eq("restaurant_id", DEFAULT_RESTAURANT_ID)
          .eq("disponible", false),
      ]);

      if (cancelled) return;

      const todayOrders = (ordersResult.data ?? []) as Array<{ total: number }>;
      setStats({
        revenueToday: todayOrders.reduce((sum, order) => sum + order.total, 0),
        ordersToday: todayOrders.length,
        activeOrders: activeResult.count ?? 0,
        pendingReservations: reservationsResult.count ?? 0,
        itemsOnMenu: onMenuResult.count ?? 0,
        itemsHidden: hiddenResult.count ?? 0,
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
      {/* Tant que la commande en ligne est en pause, afficher un chiffre
          d'affaires figé à 0 laisserait croire à une panne : on montre à la
          place l'état réel de la carte. */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {ONLINE_ORDERING_ENABLED ? (
          <StatCard
            label="Chiffre d'affaires aujourd'hui"
            value={stats ? formatCurrency(stats.revenueToday, "fr") : "—"}
            hint={stats ? `${stats.ordersToday} commande${stats.ordersToday > 1 ? "s" : ""}` : undefined}
          />
        ) : (
          <StatCard
            label="Plats sur la carte"
            value={stats ? String(stats.itemsOnMenu) : "—"}
            hint="Visibles par les clients"
          />
        )}
        {ONLINE_ORDERING_ENABLED ? (
          <StatCard
            label="Commandes en cours"
            value={stats ? String(stats.activeOrders) : "—"}
            hint="En attente ou en préparation"
          />
        ) : (
          <StatCard
            label="Plats masqués"
            value={stats ? String(stats.itemsHidden) : "—"}
            hint="Retirés de la carte, récupérables"
          />
        )}
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
                  : tile.muted
                    ? "border-dashed border-[var(--color-light-gray)] bg-white text-[var(--color-dark-green)]/55"
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
              {/* La couleur est posée explicitement : héritée du lien, elle
                  retombait sur le noir du body et devenait illisible sur la
                  tuile sombre. */}
              <span
                className={`mt-4 text-lg font-bold ${
                  tile.accent ? "text-white" : "text-[var(--color-dark-green)]"
                }`}
              >
                {tile.label}
              </span>
              <span
                className={`mt-1 text-sm ${
                  tile.accent ? "text-white/85" : "text-[var(--color-black)]/65"
                }`}
              >
                {tile.description}
              </span>
              <span
                className={`mt-4 text-sm font-semibold ${
                  tile.accent ? "text-white" : "text-[var(--color-dark-green)]"
                }`}
              >
                Ouvrir →
              </span>
            </Link>
          );
        })}
      </div>
    </PageShell>
  );
}
