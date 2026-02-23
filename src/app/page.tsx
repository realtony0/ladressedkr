import Link from "next/link";

import { Card, CardTitle } from "@/components/common/card";
import { PageShell } from "@/components/layout/page-shell";

const modules = [
  {
    href: "/12",
    title: "Expérience Client QR",
    description: "Menu bilingue, filtre allergènes, panier, commande live, appel cuisine et suivi statut.",
  },
  {
    href: "/cuisine",
    title: "Dashboard Cuisine",
    description: "Commandes en temps réel, ETA, tickets imprimables, gestion des ruptures et historique du jour.",
  },
  {
    href: "/12/commandes",
    title: "Commandes Client",
    description: "Page dédiée au suivi des commandes en cours et à l'historique de session.",
  },
  {
    href: "/admin",
    title: "Administration",
    description: "Page admin dédiée avec modules séparés: menu, QR, promotions, horaires et personnel.",
  },
  {
    href: "/proprio",
    title: "Vue Propriétaire",
    description: "Page propriétaire dédiée avec accès dashboard analytics et rapports/export.",
  },
];

export default function Home() {
  return (
    <PageShell
      title="L'Adresse Dakar"
      subtitle="Plateforme fullstack de gestion restaurant: client, cuisine, admin et propriétaire, connectée à Supabase Realtime."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {modules.map((module) => (
          <Link key={module.href} href={module.href} className="animate-rise-in">
            <Card className="h-full transition-transform hover:-translate-y-1">
              <CardTitle className="font-heading text-2xl">{module.title}</CardTitle>
              <p className="mt-3 text-sm text-[var(--color-black)]/80">{module.description}</p>
              <span className="mt-4 inline-block text-sm font-bold text-[var(--color-sage)]">Ouvrir →</span>
            </Card>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
