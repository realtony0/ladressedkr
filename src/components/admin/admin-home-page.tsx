import Link from "next/link";
import {
  BarChart3,
  BellRing,
  Clock3,
  QrCode,
  Tag,
  UsersRound,
  UtensilsCrossed,
} from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";

const TILES = [
  {
    href: "/cuisine",
    label: "Commandes en direct",
    description: "Les commandes des clients qui arrivent, en temps réel.",
    icon: BellRing,
    accent: true,
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
];

export function AdminHomePage() {
  return (
    <PageShell
      title="Tableau de bord"
      subtitle="Tout votre restaurant au même endroit. Choisissez ce que vous voulez gérer."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((tile) => {
          const Icon = tile.icon;
          return (
            <Link
              key={tile.href}
              href={tile.href}
              className={`group flex flex-col rounded-2xl border p-5 transition-all hover:-translate-y-1 hover:shadow-lg ${
                tile.accent
                  ? "border-[var(--color-dark-green)] bg-[var(--color-dark-green)] text-white"
                  : "border-[var(--color-light-gray)] bg-white text-[var(--color-dark-green)]"
              }`}
            >
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
